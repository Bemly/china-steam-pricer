create table main.t4
(
    n1 integer
        constraint t4_pk
            primary key
        constraint t4_t3_n1_fk
            references main.t3,
    n3 integer
);

