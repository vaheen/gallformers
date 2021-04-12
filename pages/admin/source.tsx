import { constant, pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import { GetServerSideProps } from 'next';
import { ParsedUrlQuery } from 'querystring';
import React from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import * as yup from 'yup';
import useAdmin from '../../hooks/useadmin';
import { AdminFormFields } from '../../hooks/useAPIs';
import { extractQueryParam } from '../../libs/api/apipage';
import { SourceApi, SourceUpsertFields } from '../../libs/api/apitypes';
import { allSources } from '../../libs/db/source';
import Admin from '../../libs/pages/admin';
import { mightFailWithArray } from '../../libs/utils/util';

const schema = yup.object().shape({
    mainField: yup.mixed().required(),
    author: yup.string().required(),
    pubyear: yup.string().matches(/([12][0-9]{3})/),
    citation: yup.string().required(),
});

type Props = {
    id: string;
    sources: SourceApi[];
};

type FormFields = AdminFormFields<SourceApi> & Omit<SourceApi, 'id' | 'title'>;

const updateSource = (s: SourceApi, newValue: string) => ({
    ...s,
    title: newValue,
});

const toUpsertFields = (fields: FormFields, name: string, id: number): SourceUpsertFields => {
    return {
        ...fields,
        id: id,
        title: name,
    };
};

const updatedFormFields = async (s: SourceApi | undefined): Promise<FormFields> => {
    if (s != undefined) {
        return {
            mainField: [s],
            author: s.author,
            pubyear: s.pubyear,
            link: s.link,
            citation: s.citation,
            del: false,
        };
    }

    return {
        mainField: [],
        author: '',
        pubyear: '',
        link: '',
        citation: '',
        del: false,
    };
};

const createNewSource = (title: string): SourceApi => ({
    title: title,
    author: '',
    citation: '',
    id: -1,
    link: '',
    pubyear: '',
});

const Source = ({ id, sources }: Props): JSX.Element => {
    const {
        selected,
        showRenameModal: showModal,
        setShowRenameModal: setShowModal,
        error,
        setError,
        deleteResults,
        setDeleteResults,
        renameCallback,
        form,
        formSubmit,
        mainField,
    } = useAdmin(
        'Source',
        id,
        sources,
        updateSource,
        toUpsertFields,
        { keyProp: 'title', delEndpoint: '../api/source/', upsertEndpoint: '../api/source/upsert' },
        schema,
        updatedFormFields,
        createNewSource,
    );

    return (
        <Admin
            type="Source"
            keyField="title"
            editName={{ getDefault: () => selected?.title, renameCallback: renameCallback(formSubmit) }}
            setShowModal={setShowModal}
            showModal={showModal}
            setError={setError}
            error={error}
            setDeleteResults={setDeleteResults}
            deleteResults={deleteResults}
            selected={selected}
        >
            <form onSubmit={form.handleSubmit(formSubmit)} className="m-4 pr-4">
                <h4>Add/Edit Sources</h4>
                <Row className="form-group">
                    <Col>
                        <Row>
                            <Col>Title:</Col>
                        </Row>
                        <Row>
                            <Col>{mainField('title', 'Source')}</Col>
                            {selected && (
                                <Col xs={1}>
                                    <Button variant="secondary" className="btn-sm" onClick={() => setShowModal(true)}>
                                        Rename
                                    </Button>
                                </Col>
                            )}
                        </Row>
                    </Col>
                </Row>
                <Row className="form-group">
                    <Col>
                        Author:
                        <input {...form.register('author')} type="text" placeholder="Author(s)" className="form-control" />
                        {form.formState.errors.author && <span className="text-danger">You must provide an author.</span>}
                    </Col>
                    <Col>
                        Publication Year:
                        <input {...form.register('pubyear')} type="text" placeholder="Pub Year" className="form-control" />
                        {form.formState.errors.pubyear && (
                            <span className="text-danger">You must provide a valid 4 digit year.</span>
                        )}
                    </Col>
                </Row>
                <Row className="form-group">
                    <Col>
                        Reference Link:
                        <input {...form.register('link')} type="text" placeholder="Link" className="form-control" />
                    </Col>
                </Row>
                <Row className="form-group">
                    <Col>
                        <p>
                            Citation (
                            <a href="https://www.mybib.com/tools/mla-citation-generator" target="_blank" rel="noreferrer">
                                MLA Form
                            </a>
                            ):
                        </p>
                        <textarea {...form.register('citation')} placeholder="Citation" className="form-control" rows={8} />
                        {form.formState.errors.citation && (
                            <span className="text-danger">You must provide a citation in MLA form.</span>
                        )}
                    </Col>
                </Row>
                <Row className="fromGroup" hidden={!selected}>
                    <Col xs="1">Delete?:</Col>
                    <Col className="mr-auto">
                        <input {...form.register('del')} type="checkbox" className="form-check-input" />
                    </Col>
                </Row>
                <Row className="formGroup">
                    <Col>
                        <input type="submit" className="button" value="Submit" />
                    </Col>
                </Row>
            </form>
        </Admin>
    );
};

export const getServerSideProps: GetServerSideProps = async (context: { query: ParsedUrlQuery }) => {
    const queryParam = 'id';
    // eslint-disable-next-line prettier/prettier
    const id = pipe(
        extractQueryParam(context.query, queryParam),
        O.getOrElse(constant('')),
    );
    return {
        props: {
            id: id,
            sources: await mightFailWithArray<SourceApi>()(allSources()),
        },
    };
};

export default Source;
