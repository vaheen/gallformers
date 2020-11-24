// Various and sundry utils for dealign with data that comes back from the database.
// Ideally we would figure out a way to deal with all the null nonsense that can happen with optional
// fields in Prisma but for now it is this...

export function mightBeNull<T extends string | string[] | number>(x: T | null | undefined): T {
    if (x == null || x == undefined) {
        return '' as T;
    }
    return x;
}
