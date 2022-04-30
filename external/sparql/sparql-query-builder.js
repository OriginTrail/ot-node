const constants = require('../../modules/constants');

class SparqlQueryBuilder {
    findGraphByNQuads(nquads) {
        return `SELECT ?g
                WHERE {
                    GRAPH ?g {
                        ${nquads}
                    }
                }`;
    }

    findNQuadsByGraphUri(uri) {
        return `PREFIX schema: <http://schema.org/>
                CONSTRUCT { ?s ?p ?o }
                WHERE {
                    GRAPH <${constants.DID_PREFIX}:${uri}> {
                        ?s ?p ?o
                    }
                }`;
    }

    findAssertionIdsByKeyword(keyword, options, localQuery) {
        return `PREFIX schema: <http://schema.org/>
                SELECT distinct ?assertionId
                WHERE {
                    ?assertionId schema:hasKeywords ?keyword .
                    ${!localQuery ? ' ?assertionId schema:hasVisibility "public" .' : ''}
                    ${options.prefix ? `FILTER contains(lcase(?keyword),'${keyword}')` : `FILTER (lcase(?keyword) = '${keyword}')`}
                }
                ${options.limit ? `LIMIT ${options.limit}` : ''}`;
    }

    findAssetsByKeyword(keyword, options, localQuery) {
        return `PREFIX schema: <http://schema.org/>
                SELECT ?assertionId
                WHERE {
                    ?assertionId schema:hasTimestamp ?latestTimestamp ;
                ${!localQuery ? 'schema:hasVisibility "public" ;' : ''} schema:hasUALs ?assetId .
                        {
                            SELECT ?assetId (MAX(?timestamp) AS ?latestTimestamp)
                            WHERE {
                                ?assertionId schema:hasKeywords ?keyword ;
                                                schema:hasIssuer ?issuer ;
                                                schema:hasType ?type ;
                                                schema:hasTimestamp ?timestamp ;
                                                schema:hasUALs ?assetId .
                    ${options.prefix ? `FILTER contains(lcase(?keyword),'${keyword}')` : `FILTER (lcase(?keyword) = '${keyword}')`}
                    ${options.issuers ? `FILTER (?issuer IN (${JSON.stringify(options.issuers).slice(1, -1)}))` : ''}
                    ${options.types ? `FILTER (?type IN (${JSON.stringify(options.types).slice(1, -1)}))` : ''}
                            }
                            GROUP BY ?assetId
                            ${options.limit ? `LIMIT ${options.limit}` : ''}
                        }
                }`;
    }

    findAssertionsByUAL(ual) {
        return `PREFIX schema: <http://schema.org/>
            SELECT ?assertionId ?issuer ?timestamp
            WHERE {
                 ?assertionId schema:hasUALs "${ual}" ;
                     schema:hasTimestamp ?timestamp ;
                     schema:hasIssuer ?issuer .
            }
            ORDER BY DESC(?timestamp)`;
    }
}

module.exports = SparqlQueryBuilder;
