INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'data_providers', 'data_providers', 4, 'CREATE TABLE data_providers (
	id int auto_increment primary key,
	ip varchar(70), 
	description varchar(200)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_data_providers_1', 'data_providers', 5, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'data_creators', 'data_creators', 6, 'CREATE TABLE data_creators (
	id int auto_increment primary key,
	dc_wallet varchar(50),
	dc_kademlia_id varchar(128),
	public_key varchar(2048)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_data_creators_1', 'data_creators', 7, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'data_holders', 'data_holders', 8, 'CREATE TABLE data_holders (
	id int auto_increment primary key,
	dh_wallet varchar(50),
	dh_kademlia_id varchar(128),
	data_private_key varchar(2048),
	data_public_key varchar(2048)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_data_holders_1', 'data_holders', 9, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'data_info', 'data_info', 10, 'CREATE TABLE data_info (
	id int auto_increment primary key,
	data_id int,
	total_documents int,
	total_data_blocks int,
	root_hash varchar(40),
	import_timestamp timestamp default current_timestamp
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_data_info_1', 'data_info', 11, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'holding_data', 'holding_data', 12, 'CREATE TABLE holding_data (
	id int auto_increment primary key,
	dc_id int,
	data_id int,
	start_time timestamp default current_timestamp,  
	end_time timestamp null default null, 
	total_token_amount real,
	data_size real,
	my_stake real,
	dc_stake real,
	foreign key (dc_id) references data_creators(id),
	foreign key (data_id) references data_info(id)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_holding_data_1', 'holding_data', 13, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'replicated_data', 'replicated_data', 14, 'CREATE TABLE replicated_data (
	id int auto_increment primary key,
	dh_id int, 
	data_id int,
	start_time timestamp default current_timestamp,  
	end_time timestamp null default null, 
	total_amount real, 
	dh_stake real, 
	my_stake real,
	foreign key (dh_id) references data_holders (id),
	foreign key (data_id) references data_info (id)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_replicated_data_1', 'replicated_data', 15, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'interaction_log', 'interaction_log', 16, 'CREATE TABLE interaction_log (
	id int auto_increment primary key,
	actor_wallet varchar(50), 
	action_type varchar(100), 
	action_time timestamp, 
	transaction_hash varchar(128)
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_interaction_log_1', 'interaction_log', 17, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'blockchain_data', 'blockchain_data', 18, 'CREATE TABLE blockchain_data (
	id int auto_increment primary key,
	blockchain_title varchar(128), 
	network_id varchar(20), 
	gas_limit int, 
	gas_price int
)');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_blockchain_data_1', 'blockchain_data', 19, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'graph_database', 'graph_database', 20, 'CREATE TABLE graph_database (id int auto_increment PRIMARY KEY, database_system varchar (128), username varchar (50), password varchar (50), host varchar (255), port int, max_path_length int, "database" VARCHAR (50))');
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('index', 'sqlite_autoindex_graph_database_1', 'graph_database', 21, null);
INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', 'node_configs', 'node_configs', 2, 'CREATE TABLE "node_configs"
(
    id TEXT,
    node_wallet VARCHAR,
    node_private_key VARCHAR,
    node_rpc_ip VARCHAR,
    node_rpc_port INTEGER,
    node_kademlia_id VARCHAR,
    node_kademlia_port INTEGER,
    is_beacon BOOLEAN,
    kademlia_seed_ip VARCHAR,
    selected_graph_database INTEGER,
    selected_blockchain INTEGER,
    request_timeout INTEGER,
    ssl_key_path VARCHAR,
    ssl_certificate_path VARCHAR,
    private_extended_key_path VARCHAR,
    child_derivation_index INTEGER,
    cpus INTEGER
, embedded_wallet_directory VARCHAR(255) NULL, embedded_peercache_path VARCHAR(255) NULL, onion_virtual_port INT NULL, traverse_nat_enabled INT DEFAULT 1 NULL, traverse_port_forward_ttl INT DEFAULT 0 NULL, verbose_logging INT DEFAULT 0 NULL, control_port_enabled INT DEFAULT 0 NULL, control_port INT DEFAULT 5275 NULL, control_sock_enabled INT DEFAULT 1 NULL, control_sock VARCHAR(255) NULL, onion_enabled INT DEFAULT 0 NULL, test_network INT DEFAULT 0 NULL, ssl_authority_paths TEXT NULL, network_bootstrap_nodes TEXT NULL)');