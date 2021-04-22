import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import BootstrapTable, { ColumnDescription } from 'react-bootstrap-table-next';
import Edit from '../../../components/edit';
import { GallTaxon, SimpleSpecies, SourceWithSpeciesApi } from '../../../libs/api/apitypes';
import { allSourceIds, sourceById } from '../../../libs/db/source';
import { getStaticPathsFromIds, getStaticPropsWithContext } from '../../../libs/pages/nextPageHelpers';

type Props = {
    source: SourceWithSpeciesApi;
};

const linkSpecies = (cell: string, s: SimpleSpecies) => {
    const hostOrGall = s.taxoncode === GallTaxon ? 'gall' : 'host';
    return (
        <Link key={s.id} href={`/${hostOrGall}/${s.id}`}>
            <a>{s.name}</a>
        </Link>
    );
};

const columns: ColumnDescription[] = [
    {
        dataField: 'name',
        text: 'Name',
        sort: true,
        formatter: linkSpecies,
    },
    {
        dataField: 'taxoncode',
        text: 'Taxon Type',
        sort: true,
    },
];

const Source = ({ source }: Props): JSX.Element => {
    const router = useRouter();
    // If the page is not yet generated, this will be displayed initially until getStaticProps() finishes running
    if (router.isFallback) {
        return <div>Loading...</div>;
    }

    return (
        <div className="p-3 m-3">
            <Head>
                <title>{source.title}</title>
            </Head>

            <Row className="pb-4">
                <Col>
                    <h2>{source.title}</h2>
                    <span>
                        <a href={source.link}>{source.link}</a>
                    </span>
                </Col>
                <Col xs={2}>
                    <span className="p-0 pr-1 my-auto">
                        <Edit id={source.id} type="source" />
                        <OverlayTrigger
                            placement="left"
                            overlay={
                                <Tooltip id="datacomplete">
                                    {source.datacomplete
                                        ? 'This source has been comprehensively reviewed and all relevant information entered.'
                                        : 'We are still working on this source so information from the source is potentially still missing.'}
                                </Tooltip>
                            }
                        >
                            <Button variant="outline-light">{source.datacomplete ? '💯' : '❓'}</Button>
                        </OverlayTrigger>
                    </span>
                </Col>
            </Row>
            <Row className="pb-1">
                <Col>
                    <strong>Authors:</strong> {source.author}
                </Col>
                <Col>
                    <strong>License:</strong>{' '}
                    {source.licenselink ? (
                        <a href={source.licenselink} target="_blank" rel="noreferrer">
                            {source.license}
                        </a>
                    ) : (
                        <span>{source.license}</span>
                    )}
                </Col>
            </Row>
            <Row className="pb-4">
                <Col>
                    <strong>Publication Year:</strong> {source.pubyear}
                </Col>
            </Row>
            <Row className="pb-4">
                <Col>
                    <strong>Citation (MLA Form):</strong> <i>{source.citation}</i>
                </Col>
            </Row>
            <Row>
                <Col>
                    <strong>Connected Species:</strong>
                    <BootstrapTable
                        keyField={'id'}
                        data={source.species}
                        columns={columns}
                        bootstrap4
                        striped
                        headerClasses="table-header"
                        defaultSorted={[
                            {
                                dataField: 'name',
                                order: 'asc',
                            },
                        ]}
                    />
                </Col>
            </Row>
        </div>
    );
};

// Use static so that this stuff can be built once on the server-side and then cached.
export const getStaticProps: GetStaticProps = async (context) => {
    const source = getStaticPropsWithContext(context, sourceById, 'source');

    return {
        props: {
            source: (await source)[0],
        },
        revalidate: 1,
    };
};

export const getStaticPaths: GetStaticPaths = async () => getStaticPathsFromIds(allSourceIds);

export default Source;
