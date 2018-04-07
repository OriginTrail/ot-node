CREATE TABLE blockchain_data
(
  id               INT auto_increment
    PRIMARY KEY,
  blockchain_title VARCHAR(128),
  network_id       VARCHAR(20),
  gas_limit        INT,
  gas_price        INT
);

CREATE TABLE data_creators
(
  id             INT auto_increment
    PRIMARY KEY,
  dc_wallet      VARCHAR(50),
  dc_kademlia_id VARCHAR(128),
  public_key     VARCHAR(2048)
);

CREATE TABLE data_holders
(
  id               INT auto_increment
    PRIMARY KEY,
  dh_wallet        VARCHAR(50),
  dh_kademlia_id   VARCHAR(128),
  data_private_key VARCHAR(2048),
  data_public_key  VARCHAR(2048)
);

CREATE TABLE data_info
(
  id                INT auto_increment
    PRIMARY KEY,
  data_id           INT,
  total_documents   INT,
  total_data_blocks INT,
  root_hash         VARCHAR(40),
  import_timestamp  TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE data_providers
(
  id          INT auto_increment
    PRIMARY KEY,
  ip          VARCHAR(70),
  description VARCHAR(200)
);

CREATE TABLE graph_database
(
  id              INT auto_increment
    PRIMARY KEY,
  database_system VARCHAR(128),
  username        VARCHAR(50),
  password        VARCHAR(50),
  host            VARCHAR(255),
  port            INT,
  max_path_length INT,
  database        VARCHAR(50)
);

CREATE TABLE holding_data
(
  id                 INT auto_increment
    PRIMARY KEY,
  dc_id              INT
    REFERENCES data_creators,
  data_id            INT
    REFERENCES data_info,
  start_time         TIMESTAMP DEFAULT current_timestamp,
  end_time           TIMESTAMP DEFAULT NULL,
  total_token_amount REAL,
  data_size          REAL,
  my_stake           REAL,
  dc_stake           REAL
);

CREATE TABLE interaction_log
(
  id               INT auto_increment
    PRIMARY KEY,
  actor_wallet     VARCHAR(50),
  action_type      VARCHAR(100),
  action_time      TIMESTAMP,
  transaction_hash VARCHAR(128)
);

CREATE TABLE node_configs
(
  id                        TEXT,
  node_wallet               VARCHAR,
  node_private_key          VARCHAR,
  node_rpc_ip               VARCHAR,
  node_rpc_port             INTEGER,
  node_kademlia_id          VARCHAR,
  node_kademlia_port        INTEGER,
  is_beacon                 BOOLEAN,
  kademlia_seed_ip          VARCHAR,
  selected_graph_database   INTEGER,
  selected_blockchain       INTEGER,
  request_timeout           INTEGER,
  ssl_key_path              VARCHAR,
  ssl_certificate_path      VARCHAR,
  private_extended_key_path VARCHAR,
  child_derivation_index    INTEGER,
  cpus                      INTEGER,
  embedded_wallet_directory VARCHAR(255),
  embedded_peercache_path   VARCHAR(255),
  onion_virtual_port        INT,
  traverse_nat_enabled      INT DEFAULT 1,
  traverse_port_forward_ttl INT DEFAULT 0,
  verbose_logging           INT DEFAULT 0,
  control_port_enabled      INT DEFAULT 0,
  control_port              INT DEFAULT 5275,
  control_sock_enabled      INT DEFAULT 1,
  control_sock              VARCHAR(255),
  onion_enabled             INT DEFAULT 0,
  test_network              INT DEFAULT 0,
  ssl_authority_paths       TEXT,
  network_bootstrap_nodes   TEXT
);

CREATE TABLE replicated_data
(
  id           INT auto_increment
    PRIMARY KEY,
  dh_id        INT
    REFERENCES data_holders,
  data_id      INT
    REFERENCES data_info,
  start_time   TIMESTAMP DEFAULT current_timestamp,
  end_time     TIMESTAMP DEFAULT NULL,
  total_amount REAL,
  dh_stake     REAL,
  my_stake     REAL
);

