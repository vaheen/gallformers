import { yupResolver } from '@hookform/resolvers/yup';
import { host, species, speciessource } from '@prisma/client';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import React, { useState } from 'react';
import { Col, ListGroup, ListGroupItem, Row } from 'react-bootstrap';
import { Typeahead } from 'react-bootstrap-typeahead';
import { Controller, useForm } from 'react-hook-form';
import * as yup from 'yup';
import Auth from '../../components/auth';
import { HostInsertFields, SpeciesSourceInsertFields } from '../../libs/apitypes';
import { allGalls } from '../../libs/db/gall';
import { allHosts } from '../../libs/db/host';
import { normalizeToArray } from '../../libs/utils/forms';

type Props = {
    galls: species[];
    hosts: species[];
};

const Schema = yup.object().shape({
    galls: yup.array().required(),
    hosts: yup.array().required(),
});

const GallHost = ({ galls, hosts }: Props): JSX.Element => {
    const [results, setResults] = useState(new Array<host>());
    const { handleSubmit, errors, control } = useForm({
        mode: 'onBlur',
        resolver: yupResolver(Schema),
    });

    const onSubmit = async (data: { galls: string[]; hosts: string[] }) => {
        try {
            const insertData: HostInsertFields = {
                galls: data.galls.map((s) => {
                    // i hate null... :( these should be safe since the text values came from the same place as the ids
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return galls.find((sp) => s === sp.name)!.id;
                }),
                hosts: data.hosts.map((s) => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return hosts.find((so) => s === so.name)!.id;
                }),
            };

            const res = await fetch('../api/gallhost/insert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(insertData),
            });

            if (res.status === 200) {
                setResults(await res.json());
            } else {
                const text = await res.text();
                console.log(`Got an error back code: ${res.status} and text: ${text}.`);
                throw new Error(text);
            }
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <Auth>
            <form onSubmit={handleSubmit(onSubmit)} className="m-4 pr-4">
                <h4>Map Galls & Hosts</h4>
                <Row className="form-group">
                    <Col>
                        Gall:
                        <Controller
                            control={control}
                            name="galls"
                            defaultValue={[]}
                            render={({ value, onChange, onBlur }) => (
                                <Typeahead
                                    onChange={(e: string | string[]) => {
                                        onChange(e);
                                    }}
                                    onBlur={onBlur}
                                    selected={normalizeToArray(value)}
                                    placeholder="Gall"
                                    id="Gall"
                                    options={galls.map((h) => h.name)}
                                    multiple
                                    clearButton
                                    isInvalid={!!errors.galls}
                                />
                            )}
                        />
                        {errors.galls && <span className="text-danger">You must provide a least one gall to map.</span>}
                    </Col>
                </Row>
                <Row>
                    <Col xs={1} className="p-0 m-0 mx-auto">
                        <h2>⇅</h2>
                    </Col>
                </Row>
                <Row className="form-group">
                    <Col>
                        Host:
                        <Controller
                            control={control}
                            name="hosts"
                            defaultValue={[]}
                            render={({ value, onChange, onBlur }) => (
                                <Typeahead
                                    onChange={(e: string | string[]) => {
                                        onChange(e);
                                    }}
                                    onBlur={onBlur}
                                    selected={normalizeToArray(value)}
                                    placeholder="Hosts"
                                    id="Hosts"
                                    options={hosts.map((h) => h.name)}
                                    multiple
                                    clearButton
                                    isInvalid={!!errors.hosts}
                                />
                            )}
                        />
                        {errors.hosts && <span className="text-danger">You must provide a least one host to map.</span>}
                    </Col>
                </Row>
                <Row className="form-group">
                    <Col>
                        <input type="submit" className="button" />
                    </Col>
                </Row>
                {results.length > 0 && (
                    <>
                        <span>Wrote {results.length} gall-host mappings.</span>
                        <ListGroup>
                            {results.map((r) => {
                                return (
                                    <ListGroupItem key={r.id}>
                                        Added{' '}
                                        <Link href={`/gall/${r.gall_species_id}`}>
                                            <a>gall</a>
                                        </Link>{' '}
                                        to{' '}
                                        <Link href={`/host/${r.host_species_id}`}>
                                            <a>host</a>
                                        </Link>
                                        .
                                    </ListGroupItem>
                                );
                            })}
                        </ListGroup>
                    </>
                )}
            </form>
        </Auth>
    );
};

export const getServerSideProps: GetServerSideProps = async () => {
    return {
        props: {
            galls: await allGalls(),
            hosts: await allHosts(),
        },
    };
};

export default GallHost;
