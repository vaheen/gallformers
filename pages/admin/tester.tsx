import { GetServerSideProps } from 'next';
import Head from 'next/head';
import React from 'react';
import { getFamiliesWithSpecies } from '../../libs/db/family';
import { mightFailWithArray } from '../../libs/utils/util';

type Props = {
    data: any;
};

const Tester = ({ data }: Props): JSX.Element => {
    return (
        <>
            <Head>
                <title>Tester</title>
            </Head>

            <pre>{JSON.stringify(data, null, '  ')}</pre>
        </>
    );
};

export const getServerSideProps: GetServerSideProps = async () => {
    return {
        props: {
            data: await mightFailWithArray()(getFamiliesWithSpecies(true)()),
        },
    };
};

export default Tester;
