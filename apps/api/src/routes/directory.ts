import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { lawyerSearchQuery } from "@ligala/shared/schemas";
import { resolveImageUrl } from "../lib/avatar";

/**
 * Public read-only "directory" of verified lawyers. No auth — these endpoints
 * back marketing/SEO pages and an anonymous user's initial browse experience.
 *
 * "Visible" = role=lawyer AND has a current kyc_submission in status=approved.
 * Unverified lawyers exist in the DB but never surface here.
 */
export const directory = new Hono()
  /**
   * GET /directory/lawyers — paginated search with optional filters.
   * Query: q, practiceAreaId, jurisdictionId, city, page, pageSize.
   */
  .get("/lawyers", zValidator("query", lawyerSearchQuery), async (c) => {
    const { q, practiceAreaId, jurisdictionId, city, chapterId, probono, page, pageSize } =
      c.req.valid("query");
    const conn = db();

    // Subquery: lawyerIds whose latest KYC is approved.
    const verifiedIdsRows = await conn
      .selectDistinct({ lawyerId: schema.kycSubmissions.lawyerId })
      .from(schema.kycSubmissions)
      .where(eq(schema.kycSubmissions.status, "approved"));
    const verifiedIds = verifiedIdsRows.map((r) => r.lawyerId);

    if (verifiedIds.length === 0) {
      return c.json({ items: [], total: 0, page, pageSize });
    }

    const filters = [inArray(schema.lawyerProfiles.userId, verifiedIds)];

    if (probono) {
      filters.push(eq(schema.lawyerProfiles.probonoAvailable, true));
    }

    if (chapterId) {
      filters.push(eq(schema.lawyerProfiles.ibpChapterId, chapterId));
    }

    if (q && q.trim().length > 0) {
      const like = `%${q.trim()}%`;
      filters.push(
        or(
          ilike(schema.user.name, like),
          ilike(schema.lawyerProfiles.bio, like),
          ilike(schema.lawyerProfiles.slug, like),
        )!,
      );
    }

    if (practiceAreaId) {
      const matches = await conn
        .select({ lawyerId: schema.lawyerPracticeAreas.lawyerId })
        .from(schema.lawyerPracticeAreas)
        .where(eq(schema.lawyerPracticeAreas.practiceAreaId, practiceAreaId));
      const ids = matches.map((m) => m.lawyerId);
      if (ids.length === 0) return c.json({ items: [], total: 0, page, pageSize });
      filters.push(inArray(schema.lawyerProfiles.userId, ids));
    }

    if (jurisdictionId) {
      const matches = await conn
        .select({ lawyerId: schema.lawyerJurisdictions.lawyerId })
        .from(schema.lawyerJurisdictions)
        .where(eq(schema.lawyerJurisdictions.jurisdictionId, jurisdictionId));
      const ids = matches.map((m) => m.lawyerId);
      if (ids.length === 0) return c.json({ items: [], total: 0, page, pageSize });
      filters.push(inArray(schema.lawyerProfiles.userId, ids));
    }

    if (city && city.trim().length > 0) {
      const matches = await conn
        .select({ lawyerId: schema.offices.lawyerId })
        .from(schema.offices)
        .where(ilike(schema.offices.city, `%${city.trim()}%`));
      const ids = matches.map((m) => m.lawyerId);
      if (ids.length === 0) return c.json({ items: [], total: 0, page, pageSize });
      filters.push(inArray(schema.lawyerProfiles.userId, ids));
    }

    const where = and(...filters)!;

    const countRows = await conn
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.lawyerProfiles)
      .innerJoin(schema.user, eq(schema.user.id, schema.lawyerProfiles.userId))
      .where(where);
    const total = countRows[0]?.count ?? 0;

    const rows = await conn
      .select({
        slug: schema.lawyerProfiles.slug,
        userId: schema.lawyerProfiles.userId,
        name: schema.user.name,
        image: schema.user.image,
        bio: schema.lawyerProfiles.bio,
        probonoAvailable: schema.lawyerProfiles.probonoAvailable,
        createdAt: schema.lawyerProfiles.createdAt,
      })
      .from(schema.lawyerProfiles)
      .innerJoin(schema.user, eq(schema.user.id, schema.lawyerProfiles.userId))
      .where(where)
      .orderBy(desc(schema.lawyerProfiles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Pull office city + practice areas for each result. One round trip each;
    // fine for pageSize <= 50.
    const lawyerIds = rows.map((r) => r.userId);

    const officeRows = lawyerIds.length
      ? await conn
          .select({
            lawyerId: schema.offices.lawyerId,
            city: schema.offices.city,
            region: schema.offices.region,
          })
          .from(schema.offices)
          .where(inArray(schema.offices.lawyerId, lawyerIds))
      : [];
    const officeByLawyer = new Map(
      officeRows.map((o) => [o.lawyerId, { city: o.city, region: o.region }]),
    );

    const paRows = lawyerIds.length
      ? await conn
          .select({
            lawyerId: schema.lawyerPracticeAreas.lawyerId,
            id: schema.practiceAreas.id,
            name: schema.practiceAreas.name,
          })
          .from(schema.lawyerPracticeAreas)
          .innerJoin(
            schema.practiceAreas,
            eq(schema.practiceAreas.id, schema.lawyerPracticeAreas.practiceAreaId),
          )
          .where(inArray(schema.lawyerPracticeAreas.lawyerId, lawyerIds))
      : [];
    const paByLawyer = new Map<string, { id: string; name: string }[]>();
    for (const r of paRows) {
      const list = paByLawyer.get(r.lawyerId) ?? [];
      list.push({ id: r.id, name: r.name });
      paByLawyer.set(r.lawyerId, list);
    }

    // Resolve each lawyer's photo to a presigned GET URL (or null). Signing is
    // local CPU, not an S3 round trip, so Promise.all over a page is cheap.
    const items = await Promise.all(
      rows.map(async (r) => ({
        slug: r.slug,
        name: r.name,
        bio: r.bio,
        city: officeByLawyer.get(r.userId)?.city ?? null,
        region: officeByLawyer.get(r.userId)?.region ?? null,
        verified: true,
        probonoAvailable: r.probonoAvailable,
        photoUrl: await resolveImageUrl(r.image),
        practiceAreas: paByLawyer.get(r.userId) ?? [],
      })),
    );

    return c.json({ items, total, page, pageSize });
  })

  /**
   * GET /directory/lawyers/:slug — full public profile.
   * 404 for unverified lawyers (don't leak existence).
   */
  .get("/lawyers/:slug", async (c) => {
    const slug = c.req.param("slug");
    const conn = db();

    const profile = await conn.query.lawyerProfiles.findFirst({
      where: eq(schema.lawyerProfiles.slug, slug),
    });
    if (!profile) throw new HTTPException(404, { message: "not_found" });

    const latestKyc = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.lawyerId, profile.userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    const verified = latestKyc?.status === "approved";
    if (!verified) throw new HTTPException(404, { message: "not_found" });

    const userRow = await conn.query.user.findFirst({
      where: eq(schema.user.id, profile.userId),
    });
    if (!userRow) throw new HTTPException(404, { message: "not_found" });

    const [practiceAreaRows, jurisdictionRows, office, ibpChapter] =
      await Promise.all([
        conn
          .select({ id: schema.practiceAreas.id, name: schema.practiceAreas.name })
          .from(schema.lawyerPracticeAreas)
          .innerJoin(
            schema.practiceAreas,
            eq(schema.practiceAreas.id, schema.lawyerPracticeAreas.practiceAreaId),
          )
          .where(eq(schema.lawyerPracticeAreas.lawyerId, profile.userId)),
        conn
          .select({ id: schema.jurisdictions.id, name: schema.jurisdictions.name })
          .from(schema.lawyerJurisdictions)
          .innerJoin(
            schema.jurisdictions,
            eq(schema.jurisdictions.id, schema.lawyerJurisdictions.jurisdictionId),
          )
          .where(eq(schema.lawyerJurisdictions.lawyerId, profile.userId)),
        conn.query.offices.findFirst({
          where: eq(schema.offices.lawyerId, profile.userId),
        }),
        profile.ibpChapterId
          ? conn.query.ibpChapters.findFirst({
              where: eq(schema.ibpChapters.id, profile.ibpChapterId),
            })
          : Promise.resolve(null),
      ]);

    const [schedule, faqs] = await Promise.all([
      office
        ? conn
            .select()
            .from(schema.officeSchedules)
            .where(eq(schema.officeSchedules.officeId, office.id))
            .orderBy(asc(schema.officeSchedules.dayOfWeek))
        : Promise.resolve([]),
      office
        ? conn
            .select()
            .from(schema.officeFaqs)
            .where(eq(schema.officeFaqs.officeId, office.id))
            .orderBy(asc(schema.officeFaqs.sortOrder))
        : Promise.resolve([]),
    ]);

    return c.json({
      profile: {
        slug: profile.slug,
        name: userRow.name,
        photoUrl: await resolveImageUrl(userRow.image),
        bio: profile.bio,
        barNumber: profile.barNumber,
        verified: true,
        probonoAvailable: profile.probonoAvailable,
        probonoStatement: profile.probonoStatement,
      },
      ibpChapter,
      practiceAreas: practiceAreaRows,
      jurisdictions: jurisdictionRows,
      office: office ?? null,
      schedule,
      faqs,
    });
  })

  /**
   * GET /directory/chapters — list every IBP chapter with a verified-lawyer
   * count, so the public IBP landing page can render a directory of chapters.
   */
  .get("/chapters", async (c) => {
    const conn = db();

    const verifiedIdsRows = await conn
      .selectDistinct({ lawyerId: schema.kycSubmissions.lawyerId })
      .from(schema.kycSubmissions)
      .where(eq(schema.kycSubmissions.status, "approved"));
    const verifiedIds = new Set(verifiedIdsRows.map((r) => r.lawyerId));

    const chapters = await conn
      .select()
      .from(schema.ibpChapters)
      .orderBy(asc(schema.ibpChapters.sortOrder), asc(schema.ibpChapters.name));

    const allLawyers = await conn
      .select({
        userId: schema.lawyerProfiles.userId,
        chapterId: schema.lawyerProfiles.ibpChapterId,
      })
      .from(schema.lawyerProfiles);

    const countByChapter = new Map<string, number>();
    for (const row of allLawyers) {
      if (!row.chapterId) continue;
      if (!verifiedIds.has(row.userId)) continue;
      countByChapter.set(row.chapterId, (countByChapter.get(row.chapterId) ?? 0) + 1);
    }

    const items = chapters.map((ch) => ({
      ...ch,
      memberCount: countByChapter.get(ch.id) ?? 0,
    }));
    return c.json({ items });
  })

  /**
   * GET /directory/chapters/:id — chapter detail + its verified members.
   * The id matches `ibp_chapter.id` (slug-style, e.g. "ibp-makati").
   */
  .get("/chapters/:id", async (c) => {
    const id = c.req.param("id");
    const conn = db();

    const chapter = await conn.query.ibpChapters.findFirst({
      where: eq(schema.ibpChapters.id, id),
    });
    if (!chapter) throw new HTTPException(404, { message: "chapter_not_found" });

    const verifiedIdsRows = await conn
      .selectDistinct({ lawyerId: schema.kycSubmissions.lawyerId })
      .from(schema.kycSubmissions)
      .where(eq(schema.kycSubmissions.status, "approved"));
    const verifiedIds = verifiedIdsRows.map((r) => r.lawyerId);

    if (verifiedIds.length === 0) {
      return c.json({ chapter, members: [] });
    }

    const members = await conn
      .select({
        slug: schema.lawyerProfiles.slug,
        name: schema.user.name,
        bio: schema.lawyerProfiles.bio,
        probonoAvailable: schema.lawyerProfiles.probonoAvailable,
      })
      .from(schema.lawyerProfiles)
      .innerJoin(schema.user, eq(schema.user.id, schema.lawyerProfiles.userId))
      .where(
        and(
          eq(schema.lawyerProfiles.ibpChapterId, id),
          inArray(schema.lawyerProfiles.userId, verifiedIds),
        ),
      )
      .orderBy(asc(schema.user.name));

    return c.json({ chapter, members });
  });
