const { Given } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const DkgClientHelper = require('../../utilities/dkg-client-helper');

const PATH_TO_CONFIGS = './config/';
const otNodeProcessPath = './test/bdd/steps/lib/ot-node-process.js';
function getBlockchainConfiguration(localBlockchain, privateKey, publicKey, managementKey) {
    return [
        {
            defaultImplementation: 'ganache',
            implementation: {
                ganache: {
                    config: {
                        blockchainTitle: 'ganache',
                        networkId: 'ganache::testnet',
                        rpcEndpoints: ['http://localhost:7545'],
                        hubContractAddress: localBlockchain.uaiRegistryContractAddress(),
                        publicKey,
                        privateKey,
                        managementKey,
                    },
                },
            },
        },
    ];
}

Given(/^I setup (\d+) node[s]*$/, { timeout: 220000 }, function nodeSetup(nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);
    const wallets = this.state.localBlockchain.getWallets();
    let nodesStarted = 0;
    for (let i = 0; i < nodeCount; i += 1) {
        const wallet = wallets[i + 1];
        // TODO: change hardcoded networkPrivateKeys
        // const networkPrivateKeys = [
        //     'CAAS4AQwggJcAgEAAoGBALA5bjrJBEfJSvqTyeFsPE6GPw6AQVS6fPhht6+2cp3H3zmavu8g0f+iiNk6NZU3wEElw4AX6c7cifEHkr2m2Y6d4p8CL2TEyXv4hjJYSV1WxINtRqZu7RCFVL+bSYaXBHsapYNJ93/gvU5/OImwV83vBL+Yvq06BWaYdzZbVw5jAgMBAAECgYB9BkHOMw92XrlzTabM551hmJzkDNpM4oIHNky7vRVUG5mjpMYRoZdbZlTwyPt7AjLEBabOGiknOhAjkNvq8ZUnDC7dCBO0Xyk5GkyuGyhhxw0C8leM7wwhQP49OoAbf0HeBRHDL5oXIZzbTAnyZgOsqCSIMwms6uQM6sCU38ByAQJBANgsxNTwEQJ3wQ2qME9Hc2RK7qmTwbkDzA95B1l6ybo1BujuacbjfMUWfjTqWbmpBFHzbbIvRyuy+j3Lskh108kCQQDQsIQSMtZi1stIjyTgiWsvAHxHKi0WUuPWaWJRU6NRoxHX8vU1vzqhcZ9C4G5sE/4NYWUmxSLQvTzg2a3UCi7LAkAL3xGEHBbjCs6IQJNclzDoDhFjMKEP1vyK0PutV0fiuOzDN+yJJo8Ah8awgzogLv70vSiGA4CmDrMdV6VXw1i5AkEAvmIKWr/eLVVfJtbQAbfb/Iko15N2hoMgL578fs0alYN659NSOLI4Psh1ToGIuziR8IsFyJTX6i55t3deya5weQJASEe9KtJfu5md4/GeSIFJZ4JwZoSxg7vayKZKRyesdGeNR1DDn1ZyvaxQ2N0azO83KYGCfrD4AXnf0zDDNT88DQ==',
        //     'CAAS4AQwggJcAgEAAoGBANw0I5RhwvTiJSiOEDCOKHqbummQxUIGjG55+00IpIOzDEdaNfmtyAoTM95Lc8q/IL75m7EeGLOstJbOWEfHsNiuDw8E9K11wO8lVee+GeW7FwMXbY0BTXitwAAWgRD7Q2y9QVqDdS0K1EYt53eYRMRjjxfUw3yNt3qvHYFhTH23AgMBAAECgYB5Gct/bQxUtJIO7aIFsgic9UvdhpqVJxjQIRGNWfVv4GYeT4RjnajnsYvS8tfpZpdRr+Bp1c1r8s0WKsDuKOoeGtqsayS+8N0MqCKsODOwue7HDXUjvA9qFELa8GOi1Lza/ThYCb01LCYIAnjiPpNPzNqbN5UurHVGSO/Lg1WyYQJBAPGdsw8pnFej/3O5yjEfm4RTdWE/8xW03UlVhNpT++AlxlcN9h55Qtt4/1+R95Gc4heiunA3eZYAIOfL056LxP8CQQDpUBvk2hFDMJmvMxrRJrf0imlUTMKN2+00c3cMvUZ7awtYEiRa1RWS2ChGRBQx27tfNjDp3TWSGoParkg9Oa9JAkB6ifaEXCA0urIWKUYIf/VJuWIwvlQ00BPi24KTkECQP9hF0ojej7V+xfEOsWMT8LMiNZ/Exf3eO5Z0uQVMxapVAkABN6/Nk+2/IgPLTEL5kHApUIeYLwZc4ybrvSaD5ID3p+lZPk7+Qlpod8ROCZDpabIinw/GSKc86fKCM6Kg3yoxAkEAxVf7qnPfM3tem4Y6pw9pnlfOYOYnJV07D4zHi6mNmXLeNbbFwMjVosB8KHYlM1WxxB62dOGUQm+5cHtfXN8ASA==',
        //     'CAAS3wQwggJbAgEAAoGBAMisI+jOJLi1al6Gjr8RVRnsvolrduxgxXNYzGzHSMk3pc4t8oJUPHySCCoyjoNeaLFIgD+LUekTlnWOESMx+QokaKCP801y+f2b36gnYyqa5NmHVocyauZjIVyYUs8GMfKj4Ot7aVwdKdysw7bd8CFVW9pMCMPtGbuYVYUh6QpFAgMBAAECgYAajayywZRaXKcWmveIkOKR66HKzU2POb7m5Hkoa7ZV6ecmwS210S+vzCMIcmgpOfTggJd30Reln9Ho/EOIRLSPRvirBOgEDOhrls5IhdqD/URH8WBS4ecu7jkYscVj6cV7WQ2ZNOd994S5GH9bqZYjSXEvHzbEVdefEAO+6Fe0AQJBAOxjIlAhcCQ3sxy1i9hd5HP3uTSIMRs0t5A0x751F1W74eMopx8YSrzPlm85Xdj/2cq3eo0q+J5ORWoQwFdoE+kCQQDZUmxfYD39JqU0t9PrviJ/eqt+BA47SJQ20e1TyEuNO1iW5CBj2m37MhvQLxD2Pk4qoNCekw/lHQdubADkSVX9AkBt7agOVY59+T0dM7wF8ZwE5gXFzTPw7/IRaMoe4vroDsh8R/J3/mb7KRpPPQFMoaaZo/uk3H/jtoiHS6T2wNrJAkAh3qyxOKiwmaNJ0hSfOyTZRV8Q5sTpDGi9Gn6ofiD4Q/WMnsVFird1XNvk2FEGb7NzBVk+PaFOjfWoigChk6RpAkB7RSGAwq2aYZkr/sua6EI/JfCxD2Hsl9YPNLinAUFjP0J5B1M3eIjZNSzbdu/iGKeP+ESm662U60/Q93vfZr/e',
        //     'CAAS3wQwggJbAgEAAoGBAMSGbdE2jrnz+KOr+tepm0xZr9c7nWK5Xoub2vnxP7zhqYdS1R/cE+LYSOb7LKn6J4doKJHPQfgS00eE8gZtQD9+8bH/+FSXpf7nsdGvlWuSXoAmLkRKwjr/CZ6a+REuWSBT2Bl1kOWL5iLrG4LZDcgbhmWZqyDInN1HwwI6tIfrAgMBAAECgYBIbWahmSLGw3RaFbLPsnFKlS8p+o2Jadm/SARO4ytjWCNbfRqQsFIf4ygTAHS4fDn/PFLfUev1GjMFg6iS18a6OYFfmfgrVTmZ9dP8ioPk86GdQ+l/n0rQJZ3AvTWyOcuPO1QNcL+vc8QtRGwgboFc/83o/zyCWDfe+a9G4bD36QJBAPwI1U0q3ayvVNszXt0njhn1XDCkqwg4/aFyzaaVmDrKAc7Jo6R05DtTFVdnxSbs4LJ4pD9DFEcRVw4OxrZ/76cCQQDHngKY4S+tV1DB6J2jFBCKtZfFF24c+pennUG4Bae9v+2CviyssIc1VrOQJbGFd1LaBRZbOlF0v+crYcllcs4dAkBWDgoOrCk+citOIQ8uAfiCIoXU0hTX3OW0/4b6by+oOxs86Rpn58WZ//dUfckSTmU2avzh4NyGm4QW97Kf07UXAkBLoDyBqQbEGEl7PWLDju15b7TxMaBBEFt2YCiuzE2xoM4d82i/gB2pgpCC8xTfaMaV3MmMhHqpza6KDAEeEzGtAkB0lwaG2m0MN78/sAnunjZJkCViturj6tgfSpQCSIMTNNerA8cgcKqXQS8z0kOKon5A/eLs6wQCdZz8JgYC7xD1'
        //   ];
        const managementWallet = wallets[i + 31];
        const rpcPort = 8901 + i;
        const nodeName = `origintrail-test-${i}`;

        /* {
            modules: {
                blockchain: getBlockchainConfiguration(
                  this.state.localBlockchain,
                  wallet.privateKey,
                  wallet.address,
                  managementWallet.address
                )[0],
                  network: {
                    enabled: true,
                      implementation: {
                        "libp2p-service": {
                            package: "./network/implementation/libp2p-service",
                              config: {
                                port: 9001 + i,
                                  bootstrap: [
                                    "/ip4/0.0.0.0/tcp/9000/p2p/QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj"
                                ],
                                  privateKey: networkPrivateKeys[i]
                            }
                        }
                    }
                },
                repository: {
                    implementation: {
                        "sequelize-repository": {
                            config: {
                                database: `operationaldbnode${i}`,
                                  password: ""
                            }
                        }
                    }
                },
                tripleStore: {
                    enabled: true,
                      defaultImplementation: "ot-graphdb",
                      implementation: {
                        "ot-graphdb": {
                            package: "./triple-store/implementation/ot-graphdb/ot-graphdb",
                              config: {
                                url: "http://localhost:7200",
                                  repository: nodeName,
                                  username: "admin",
                                  password: ""
                            }
                        }
                    }
                },
                validation: {
                    enabled: true,
                      implementation: {
                        "merkle-validation": {
                            package: "./validation/implementation/merkle-validation",
                              config: {}
                        }
                    }
                },
                httpClient: {
                    enabled: true,
                      implementation: {
                        "express-http-client": {
                            package: "./http-client/implementation/express-http-client",
                              config: {
                                useSsl: false,
                                  port: rpcPort,
                                  sslKeyPath: "/root/certs/privkey.pem",
                                  sslCertificatePath: "/root/certs/fullchain.pem",
                                  rateLimiter: {
                                    timeWindowSeconds: 60,
                                      maxRequests: 10
                                }
                            }
                        }
                    }
                }
            },
            operationalDatabase: {
                databaseName: `operationaldbnode${i}`
            },
            graphDatabase: {
                name: nodeName
            },
            "rpcPort": rpcPort,
          minimumReplicationFactor: 4,
          appDataPath: `data${i}`
        } */

        const nodeConfiguration = JSON.parse(
            fs
                .readFileSync(
                    path.join(__dirname, `${PATH_TO_CONFIGS}origintrail-test-node-config.json`),
                )
                .toString(),
        );
        // eslint-disable-next-line prefer-destructuring
        nodeConfiguration.modules.blockchain = getBlockchainConfiguration(
            this.state.localBlockchain,
            wallet.privateKey,
            wallet.address,
            managementWallet.address,
        )[0];

        nodeConfiguration.modules.network.implementation['libp2p-service'].config.port = 9001 + i;
        // nodeConfiguration.modules.network.implementation["libp2p-service"].config.privateKey = networkPrivateKeys[i];
        nodeConfiguration.modules.repository.implementation[
            'sequelize-repository'
        ].config.database = `operationaldbnode${i}`;
        nodeConfiguration.modules.tripleStore.implementation['ot-graphdb'].config.repository =
            nodeName;
        nodeConfiguration.modules.httpClient.implementation['express-http-client'].config.port =
            rpcPort;
        nodeConfiguration.operationalDatabase.databaseName = `operationaldbnode${i}`;
        nodeConfiguration.graphDatabase.name = nodeName;
        nodeConfiguration.rpcPort = rpcPort;
        nodeConfiguration.appDataPath = `data${i}`;

        const forkedNode = fork(otNodeProcessPath, [], { silent: true });

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });
        forkedNode.send(JSON.stringify(nodeConfiguration));

        // eslint-disable-next-line no-loop-func
        forkedNode.on('message', (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.nodes[i] = {
                    client,
                    forkedNode,
                    configuration: nodeConfiguration,
                };
            }
            nodesStarted += 1;
            if (nodesStarted === nodeCount) {
                done();
            }
        });
    }
});

function forkNode(nodeName, nodeConfiguration) {
    const forkedNode = fork(otNodeProcessPath, [], { silent: true });

    const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
    forkedNode.stdout.setEncoding('utf8');
    forkedNode.stdout.on('data', (data) => {
        // Here is where the output goes
        logFileStream.write(data);
    });
    forkedNode.send(JSON.stringify(nodeConfiguration));
    return forkedNode;
}

Given(
    /^(\d+) bootstrap is running$/,
    { timeout: 120000 },
    function bootstrapRunning(nodeCount, done) {
        expect(this.state.bootstraps).to.have.length(0);
        expect(nodeCount).to.be.equal(1); // Currently not supported more.
        this.logger.log('Initializing bootstrap node');
        const nodeName = 'origintrail-test-bootstrap';
        const bootstrapNodeConfiguration = JSON.parse(
            fs
                .readFileSync(path.join(__dirname, `${PATH_TO_CONFIGS}${nodeName}-config.json`))
                .toString(),
        );
        const forkedNode = forkNode.call(this, nodeName, bootstrapNodeConfiguration);

        forkedNode.on('message', async (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: 8900,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.bootstraps.push({
                    client,
                    forkedNode,
                    configuration: bootstrapNodeConfiguration,
                });
            }
            done();
        });
    },
);

Given(
    /^I setup (\d+) additional node[s]*$/,
    { timeout: 120000 },
    function setupAdditionalNode(nodeCount, done) {
        this.logger.log(`I setup ${nodeCount} additional node${nodeCount !== 1 ? 's' : ''}`);
        const wallets = this.state.localBlockchain.getWallets();
        const currentNumberOfNodes = Object.keys(this.state.nodes).length;
        let nodesStarted = 0;
        for (let i = 0; i < nodeCount; i += 1) {
            const nodeIndex = currentNumberOfNodes + i;
            const wallet = wallets[nodeIndex];
            const rpcPort = 8901 + nodeIndex;
            const nodeName = `origintrail-test-${nodeIndex}`;
            const nodeConfiguration = {
                graphDatabase: {
                    name: nodeName,
                },
                blockchain: getBlockchainConfiguration(
                    this.state.localBlockchain,
                    wallet.privateKey,
                    wallet.address,
                ),
                operationalDatabase: {
                    databaseName: `operationaldbnode${nodeIndex}`,
                },
                rpcPort,
                network: {
                    id: 'Devnet',
                    port: 9001 + nodeIndex,
                    bootstrap: [
                        '/ip4/0.0.0.0/tcp/9000/p2p/QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
                    ],
                },
            };

            const forkedNode = forkNode.call(this, nodeName, nodeConfiguration);

            // eslint-disable-next-line no-loop-func
            forkedNode.on('message', (response) => {
                if (response.error) {
                    // todo handle error
                } else {
                    // todo if started
                    const client = new DkgClientHelper({
                        endpoint: '127.0.0.1',
                        port: rpcPort,
                        useSSL: false,
                        timeout: 25,
                    });
                    this.state.nodes[nodeIndex] = {
                        client,
                        forkedNode,
                        configuration: nodeConfiguration,
                    };
                }
                nodesStarted += 1;
                if (nodesStarted === nodeCount) {
                    done();
                }
            });
        }
    },
);
