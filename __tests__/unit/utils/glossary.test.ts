/* eslint-disable @typescript-eslint/ban-ts-comment */
import { allGlossaryEntries, Entry } from '../../../libs/db/glossary';
import { linkTextFromGlossary, testables } from '../../../libs/pages/glossary';
import { hasProp } from '../../../libs/utils/util';
import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import db from '../../../libs/db/db';

const { makeLink, stemText, linkFromStems } = testables;

const entries = [
    { id: 0, word: 'foo', definition: 'Foo bar baz', urls: [] } as Entry,
    { id: 0, word: 'bar', definition: 'Hello Foo bar baz', urls: [] } as Entry,
];

afterAll(async (done) => {
    // ugh - damn prisma. if the wait is not at least a second it fails to close the db connection.
    // without this code Jest will never terminate and in a CI env the tests will never complete.
    // this is untenable. every test that simulates the db would need this!
    // I added --force-exit to the test target in package.json - this kills everything but still stupid.
    // simply doing await db.$disconnect() does not work.
    // await new Promise((resolve) => {
    //     setTimeout(() => {
    //         db.$disconnect();
    //         resolve();
    //     }, 1000);
    // });
    done();
});

describe('makeLink tests', () => {
    test('Should create a link', () => {
        const l = makeLink('foo', 'see foo', false);
        expect(l.type).toBe('a');
        expect(l.props.href).toBe('/glossary/#foo');
        expect(l.props.children).toBe('see foo');
    });
    test('Should link within page if asked', () => {
        const l = makeLink('foo', 'see foo', true);
        expect(l.props.href).toBe('#foo');
    });
});

describe('stemText tests', () => {
    test('Should handle empty array', () => {
        expect(stemText([]).length).toBe(0);
    });
    test('Should handle valid input', () => {
        const s = stemText(entries);
        expect(s.length).toBe(2);
        expect(s.every((v) => hasProp(v, 'stem'))).toBeTruthy();
    });
});

const noTerms = 'Hello Joe!';
const has2Terms = 'Hello Joe. Have you seen foo or bar?';

describe('linkFromStems tests', () => {
    const stems = stemText(entries);
    test('Should handle empty', () => {
        expect(linkFromStems('', true)(stems).length).toBe(1);
    });
    test('Should not link to glossary items if none in text', () => {
        expect(linkFromStems(noTerms, true)(stems).length).toBe(1);
    });
    test('Should link to glossary items if in text', () => {
        // expect 5 because : ['Hello Joe. Have you seen ', linkto foo, ' or ', linkto bar, '?']
        expect(linkFromStems(has2Terms, true)(stems).length).toBe(5);
    });
});

jest.mock('../../../libs/db/glossary');

// helpers to get types correct
const ffail = (e: Error): string => {
    fail(e);
    return '';
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fvoid = (_: void): string => {
    return '';
};

describe('linkTextFromGlossary tests', () => {
    const g = TE.taskify(() => entries);
    // @ts-ignore
    allGlossaryEntries.mockResolvedValue(g);

    test('Should handle null/undefined/empty input', async () => {
        await pipe(
            linkTextFromGlossary(null),
            TE.fold(
                (err) => T.of(ffail(err)),
                (ns) => T.of(fvoid(expect(ns.length).toBe(0))),
            ),
        )();
    });
});
