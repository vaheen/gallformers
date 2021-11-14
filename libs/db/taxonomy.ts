import { PrismaPromise } from '@prisma/client';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import * as TE from 'fp-ts/lib/TaskEither';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import {
    AliasApi,
    ALL_FAMILY_TYPES,
    DeleteResult,
    FamilyGallTypesTuples,
    FamilyHostTypesTuple,
    FamilyTypesTuple,
    GallTaxon,
    HostTaxon,
    SimpleSpecies,
} from '../api/apitypes';
import {
    FAMILY,
    FamilyTaxonomy,
    FamilyUpsertFields,
    FamilyWithGenera,
    FGS,
    GeneraMoveFields,
    GENUS,
    SECTION,
    SectionApi,
    TaxonomyEntry,
    TaxonomyTree,
    TaxonomyUpsertFields,
    toTaxonomyEntry,
} from '../api/taxonomy';
import { logger } from '../utils/logger';
import { ExtractTFromPromise } from '../utils/types';
import { handleError } from '../utils/util';
import db from './db';
import { extractId } from './utils';

/**
 * Fetch a TaxonomyEntry by taxonomy id.
 * @param id
 */
export const taxonomyEntryById = (id: number): TaskEither<Error, O.Option<TaxonomyEntry>> => {
    const tax = () =>
        db.taxonomy.findFirst({
            where: { id: { equals: id } },
            include: { parent: true },
        });

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(tax, handleError),
        TE.map((t) => pipe(t, O.fromNullable, O.map(toTaxonomyEntry))),
    );
};

export const taxonomyByName = (name: string): TaskEither<Error, O.Option<TaxonomyEntry>> => {
    return pipe(
        TE.tryCatch(() => db.taxonomy.findFirst({ where: { name: { equals: name } } }), handleError),
        TE.map((t) => pipe(t, O.fromNullable, O.map(toTaxonomyEntry))),
    );
};

export const familyByName = (name: string): TaskEither<Error, O.Option<FamilyWithGenera>> => {
    return pipe(
        TE.tryCatch(
            () =>
                db.taxonomy.findFirst({
                    include: { taxonomy: true },
                    where: { AND: [{ name: { equals: name } }, { type: { equals: FAMILY } }] },
                }),
            handleError,
        ),
        TE.map((t) =>
            pipe(
                t,
                O.fromNullable,
                O.map((t) => ({
                    ...toTaxonomyEntry(t),
                    genera: t.taxonomy.map(toTaxonomyEntry),
                })),
            ),
        ),
    );
};

/**
 * Fetch a taxonomy tree for a taxonomy id.
 * @param id
 */
export const taxonomyTreeForId = (id: number): TaskEither<Error, O.Option<TaxonomyTree>> => {
    const sps = () =>
        db.taxonomy.findFirst({
            include: {
                parent: true,
                speciestaxonomy: {
                    include: {
                        species: true,
                    },
                },
                taxonomy: {
                    include: {
                        speciestaxonomy: {
                            include: {
                                species: true,
                            },
                        },
                        taxonomy: true,
                        taxonomyalias: true,
                        taxonomytaxonomy: true,
                    },
                },
                taxonomyalias: true,
            },
            where: {
                id: id,
            },
        });

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(sps, handleError),
        TE.map(O.fromNullable),
    );
};

/**
 * Fetch all families of the given type.
 * @param types the type of family to fetch
 * @see FamilyTypesTuple @see FamilyGallTypesTuples @see FamilyHostTypesTuple @see ALL_FAMILY_TYPES
 */
export const allFamilies = (
    types: FamilyTypesTuple | FamilyGallTypesTuples | FamilyHostTypesTuple = ALL_FAMILY_TYPES,
): TaskEither<Error, TaxonomyEntry[]> => {
    const families = () =>
        db.taxonomy.findMany({
            orderBy: { name: 'asc' },
            where: { AND: [{ description: { in: [...types] } }, { type: { equals: 'family' } }] },
        });

    return pipe(
        TE.tryCatch(families, handleError),
        TE.map((f) => f.map(toTaxonomyEntry)),
    );
};

export const allFamiliesWithGenera = (): TaskEither<Error, FamilyWithGenera[]> => {
    const families = () =>
        db.taxonomy.findMany({
            include: {
                taxonomy: true,
            },
            orderBy: { name: 'asc' },
            where: { type: { equals: 'family' } },
        });

    return pipe(
        TE.tryCatch(families, handleError),
        TE.map((taxs) =>
            taxs.map((tax) => ({
                ...toTaxonomyEntry(tax),
                genera: tax.taxonomy.map(toTaxonomyEntry),
            })),
        ),
    );
};

/**
 * Fetch all genera for the given taxon.
 * @param taxon
 */
export const allGenera = (taxon: typeof GallTaxon | typeof HostTaxon): TaskEither<Error, TaxonomyEntry[]> => {
    const genera = () =>
        db.taxonomy.findMany({
            include: { parent: true },
            orderBy: { name: 'asc' },
            where: {
                OR: [
                    { AND: [{ type: GENUS }, { speciestaxonomy: { some: { species: { taxoncode: taxon } } } }] },
                    { AND: [{ type: GENUS }, { name: 'Unknown' }] },
                ],
            },
        });

    return pipe(
        TE.tryCatch(genera, handleError),
        TE.map((g) => g.map(toTaxonomyEntry)),
    );
};

/**
 * Fetch all of the Sections.
 * @returns
 */
export const allSections = (): TaskEither<Error, TaxonomyEntry[]> => {
    const sections = () =>
        db.taxonomy.findMany({
            include: { parent: true },
            orderBy: { name: 'asc' },
            where: { type: SECTION },
        });

    return pipe(
        TE.tryCatch(sections, handleError),
        TE.map((f) => f.map(toTaxonomyEntry)),
    );
};

export const allSectionIds = (): TaskEither<Error, string[]> =>
    pipe(
        allSections(),
        TE.map((sections) => sections.map((s) => s.id.toString())),
    );

/**
 * A species level taxonomy will consist of:
 * - a Genus
 * - a Family
 * - optionally a Section
 * @param id
 */
export const taxonomyForSpecies = (id: number): TaskEither<Error, FGS> => {
    const tree = () => {
        const r = db.speciestaxonomy
            .findMany({
                include: {
                    taxonomy: {
                        include: {
                            parent: true,
                        },
                    },
                },
                where: { species_id: id },
            })
            .then((r) => {
                if (r == null) throw new Error(`Failed to find genus for species with id ${id}.`);

                return r;
            });

        return r;
    };

    const toFGS = (tax: ExtractTFromPromise<ReturnType<typeof tree>>): FGS => {
        const genus = tax.find((t) => t.taxonomy.type === GENUS)?.taxonomy;
        const family = genus?.parent;
        const section = O.fromNullable(tax.find((t) => t.taxonomy.type === SECTION)?.taxonomy);

        if (genus == null || family == null) {
            const msg = `Species with id ${id} is missing its family or genus.`;
            logger.error(msg);
            throw new Error(msg);
        }

        return {
            family: toTaxonomyEntry(family),
            genus: toTaxonomyEntry(genus),
            section: pipe(section, O.map(toTaxonomyEntry)),
        };
    };

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(tree, handleError),
        TE.map(toFGS),
    );
};

/**
 * Fetches either the gall or host families and all of the children in the taxonomy.
 * @param gall true for gall families, false for host families
 */
export const getFamiliesWithSpecies =
    (gall: boolean, undescribedOnly = false) =>
    (): TaskEither<Error, FamilyTaxonomy[]> => {
        const filterOnlyUndescribed = (fs: FamilyTaxonomy[]) => {
            return fs
                .map(
                    (family) =>
                        // filter out all genera that do not have an undescribed species in them
                        ({
                            ...family,
                            taxonomytaxonomy: family.taxonomytaxonomy.filter((genus) => genus.child.speciestaxonomy.length > 0),
                        } as FamilyTaxonomy),
                    // filter out famlies that have no genera in them after the above filter
                )
                .filter((f) => f.taxonomytaxonomy.length > 0);
        };

        const fams = async () => {
            const where = gall
                ? [{ type: FAMILY }, { description: { not: 'Plant' } }]
                : [{ type: FAMILY }, { description: { equals: 'Plant' } }];

            return db.taxonomy
                .findMany({
                    include: {
                        // find the genera in the family
                        taxonomytaxonomy: {
                            include: {
                                child: {
                                    include: {
                                        // and the species in the genera
                                        speciestaxonomy: {
                                            include: {
                                                species: true,
                                            },
                                            where: !undescribedOnly
                                                ? {}
                                                : {
                                                      species: {
                                                          gallspecies: { some: { gall: { undescribed: { equals: true } } } },
                                                      },
                                                  },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    where: {
                        AND: where,
                    },
                    orderBy: { name: 'asc' },
                })
                .then((fs) => (!undescribedOnly ? fs : filterOnlyUndescribed(fs)));
        };

        return TE.tryCatch(fams, handleError);
    };

/**
 * Fetches all of the ids for all of the families.
 */
export const allFamilyIds = (): TaskEither<Error, string[]> => {
    const families = () =>
        db.taxonomy.findMany({
            select: { id: true },
            where: { type: { equals: 'family' } },
        });

    return pipe(
        TE.tryCatch(families, handleError),
        TE.map((x) => x.map(extractId).map((n) => n.toString())),
    );
};

export const allGenusIds = (): TaskEither<Error, string[]> => {
    const genera = () =>
        db.taxonomy.findMany({
            select: { id: true },
            where: { type: { equals: 'genus' } },
        });

    return pipe(
        TE.tryCatch(genera, handleError),
        TE.map((x) => x.map(extractId).map((n) => n.toString())),
    );
};

export const getAllSpeciesForSectionOrGenus = (id: number): TaskEither<Error, SimpleSpecies[]> => {
    const sectionSpecies = () =>
        db.speciestaxonomy.findMany({
            where: { taxonomy_id: id },
            include: { species: true },
            orderBy: { species: { name: 'asc' } },
        });

    return pipe(
        TE.tryCatch(sectionSpecies, handleError),
        TE.map((s) => s.map((sp) => ({ ...sp.species } as SimpleSpecies))),
    );
};

export const getSection = (id: number): TaskEither<Error, O.Option<SectionApi>> => {
    const section = () =>
        db.taxonomy.findFirst({
            select: {
                id: true,
                name: true,
                description: true,
                speciestaxonomy: { include: { species: true } },
                taxonomyalias: { include: { alias: true } },
            },
            where: { id: { equals: id } },
        });

    return pipe(
        TE.tryCatch(section, handleError),
        TE.map((t) =>
            pipe(
                t,
                O.fromNullable,
                O.map(
                    (s) =>
                        ({
                            ...t,
                            species: s?.speciestaxonomy.map((sp) => ({ ...sp.species } as SimpleSpecies)),
                            aliases: s.taxonomyalias.map((a) => ({ ...a.alias } as AliasApi)),
                        } as SectionApi),
                ),
            ),
        ),
    );
};

/**
 * Delete the given taxonomy entry. If the taxoomy entry is a Family, then the delete will cascade to species and
 * delete species that are assigned to that family. So be careful!
 * @param id
 */
export const deleteTaxonomyEntry = (id: number): TaskEither<Error, DeleteResult> => {
    const doDelete = () => {
        // have to do raw calls since Prisma does not support cascade deletion.
        return db.$transaction([
            db.$executeRaw`
                DELETE FROM species
                    WHERE id IN (
                    SELECT s.id
                    FROM taxonomy AS f
                        INNER JOIN
                        taxonomy AS g ON f.id = g.parent_id
                        INNER JOIN
                        speciestaxonomy AS st ON st.taxonomy_id = g.id
                        INNER JOIN
                        species AS s ON s.id = st.species_id
                    WHERE f.id = ${id}
                );
            `,
            db.$executeRaw`
                DELETE FROM taxonomy WHERE id = ${id}
        `,
        ]);
    };

    const toDeleteResult = (t: number[]): DeleteResult => {
        return {
            type: 'taxonomy',
            name: id.toString(),
            count: t.reduce((t, x) => t + x, 0),
        };
    };

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(doDelete, handleError),
        TE.map(toDeleteResult),
    );
};

const connectSpecies = (f: TaxonomyUpsertFields) => f.species.map((s) => ({ species: { connect: { id: s } } }));

/**
 * Update or insert a Taxonomy entry.
 * @param f
 * @returns the count of the number of records added, will be 1 for success and 0 for a failure
 */
export const upsertTaxonomy = (f: TaxonomyUpsertFields): TaskEither<Error, TaxonomyEntry> => {
    const connectParentOrNot = pipe(
        f.parent,
        O.fold(
            () => ({}),
            (p) => ({ connect: { id: p.id } }),
        ),
    );

    const upsert = () =>
        db.taxonomy.upsert({
            where: { id: f.id },
            update: {
                name: f.name,
                description: f.description,
                speciestaxonomy: {
                    deleteMany: { taxonomy_id: f.id },
                    create: connectSpecies(f),
                },
                parent: connectParentOrNot,
            },
            create: {
                name: f.name,
                description: f.description,
                type: f.type,
                speciestaxonomy: {
                    create: connectSpecies(f),
                },
                parent: connectParentOrNot,
            },
        });

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(upsert, handleError),
        TE.map(toTaxonomyEntry),
    );
};

const updateExistingGenera = (fam: FamilyUpsertFields) => {
    const r = fam.genera
        .filter((g) => g.id > 0) // if it is new then we do not need to worry about it
        .map((g) =>
            db.taxonomy.update({
                where: { id: g.id },
                data: {
                    name: g.name,
                    description: g.description,
                },
            }),
        );
    return r;
};

const familyUpdateSteps = (fam: FamilyUpsertFields): PrismaPromise<unknown>[] => {
    return [
        // delete any genera that are not part of the update
        db.taxonomy.deleteMany({
            where: {
                parent_id: fam.id,
                id: { notIn: fam.genera.map((g) => g.id) },
            },
        }),

        ...updateExistingGenera(fam),

        // now we can setup relatoinships and create new genera
        db.taxonomy.update({
            where: { id: fam.id },
            data: {
                name: fam.name,
                description: fam.description,
                taxonomytaxonomy: {
                    connectOrCreate: fam.genera.map((g) => ({
                        where: {
                            taxonomy_id_child_id: {
                                child_id: g.id,
                                taxonomy_id: fam.id,
                            },
                        },
                        create: {
                            child: {
                                connectOrCreate: {
                                    where: {
                                        id: g.id,
                                    },
                                    create: {
                                        name: g.name,
                                        type: g.type,
                                        description: g.description,
                                        parent_id: fam.id,
                                    },
                                },
                            },
                        },
                    })),
                },
            },
        }),
    ];
};

const familyCreate = (f: FamilyUpsertFields): PrismaPromise<unknown>[] => {
    return [
        db.taxonomy.create({
            data: {
                name: f.name,
                description: f.description,
                type: f.type,
                parent: {},
                taxonomytaxonomy: {
                    create: f.genera.map((g) => ({
                        child: {
                            create: {
                                name: g.name,
                                description: g.description,
                                type: GENUS,
                            },
                        },
                    })),
                },
            },
        }),
    ];
};

/**
 * Update or insert a Family Taxonomy entry.
 * @param f
 * @returns the count of the number of records added, will be 1 for success and 0 for a failure
 */
export const upsertFamily = (f: FamilyUpsertFields): TaskEither<Error, FamilyWithGenera> => {
    const updateFamilyTx = TE.tryCatch(() => db.$transaction(familyUpdateSteps(f)), handleError);
    const createFamilyTx = TE.tryCatch(() => db.$transaction(familyCreate(f)), handleError);

    const getFam = () => {
        return familyByName(f.name);
    };

    return pipe(
        f.id < 0 ? createFamilyTx : updateFamilyTx,
        TE.chain(getFam),
        TE.fold(
            (e) => TE.left(e),
            (s) =>
                pipe(
                    s,
                    O.fold(
                        () => TE.left(new Error('Failed to get upserted data.')),
                        (te) => TE.right(te),
                    ),
                ),
        ),
        TE.map((x) => x),
    );
};

export const moveGenera = (f: GeneraMoveFields): TaskEither<Error, FamilyWithGenera[]> => {
    const doMove = () =>
        db.$transaction([
            // reassign the parent to the new family for all of the passed in genera
            db.taxonomy.updateMany({
                where: { id: { in: f.genera } },
                data: {
                    parent_id: f.newFamilyId,
                },
            }),
            // delete all mappings between the old family and the genera
            db.taxonomytaxonomy.deleteMany({
                where: { child_id: { in: f.genera }, taxonomy_id: f.oldFamilyId },
            }),
            // add mappings between the new family and the genera
            ...f.genera.map((g) =>
                db.taxonomytaxonomy.create({
                    data: {
                        taxonomy_id: f.newFamilyId,
                        child_id: g,
                    },
                }),
            ),
        ]);

    // eslint-disable-next-line prettier/prettier
    return pipe(
        TE.tryCatch(doMove, handleError),
        TE.chain(allFamiliesWithGenera),
    );
};
