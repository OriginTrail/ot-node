/* eslint-disable no-unused-expressions, max-len */

const {
    Then,
} = require('cucumber');
const { expect } = require('chai');

const httpApiHelper = require('./lib/http-api-helper');

Then(/^the traversal from batch "(\S+)" should contain (\d+) trail[s]* and (\d+) vertice[s]* of type (\S+)/, { timeout: 120000 }, async function (batch, numberOfTrails, numberOfVertices, vertexType) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;

    const host = dc.state.node_rpc_url;
    const trails = await httpApiHelper.apiTrail(host, {
        uid: batch,
    });

    expect(trails, 'should not be null').to.not.be.undefined;
    expect(trails, 'should be an Array').to.be.an.instanceof(Array);
    expect(trails.length, `should be ${numberOfTrails} trail(s)`).to.be.equal(numberOfTrails);

    let foundVertices = 0;
    const trail = trails[0].data;
    for (const vertex of Object.values(trail)) {
        if (vertex.vertex_type === vertexType.toUpperCase()) {
            foundVertices += 1;
        }
    }
    expect(foundVertices, `failed to find ${numberOfVertices} vertices in the trail`).to.be.equal(numberOfVertices);
});

Then(/^the last query should return same id as last import's$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastImport.data_set_id, 'Last imports data set id seems not defined').to.be.equal(true);
    expect(!!this.state.jsonQuery, 'JSON query must exist.').to.be.equal(true);


    const myNode = this.state.dc;
    const response = await httpApiHelper.apiQueryLocal(myNode.state.node_rpc_url, this.state.jsonQuery);

    expect(!!response, 'Data should exist').to.be.equal(true);
    expect(response.filter(id => id === this.state.lastImport.data_set_id).length, 'Response should be equal to last imports id').to.be.equal(response.length);
});
