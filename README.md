[![Moleculer](https://badgen.net/badge/Powered%20by/Moleculer/0e83cd)](https://moleculer.services)

# FileShard

A minimal prototype of a **Distributed File Management System (DFMS)** implemented
with [MoleculerJS](https://moleculer.services).

## Motivation

This project is meant as an implementation for an assignment in **[SE5090] Distributed Computing** module conducted as a
part of **Master of Sc. IT (Enterprise Application Development)** program offered by **Sri Lanka Institute of
Information Technology, Sri Lanka**.

## Features
- Distributed computing with `Microservice` architecture.
- Instant and universal deployment with `Docker` integration.
- Underlying `Master-Slave` clustering.
- File chunk duplication for redundancies.
- Fault tolerance with `Bulkhead` and `Circuit-Breaker` architectures.
- In-built request tracking, tracing and log capabilities with `Prometheus` metrics.

## Usage

### Pre-requisites

- Docker

Start the services with `npm run dc:up` command. This will execute the relevant `docker-compose up -d` command and spin
up all the necessary containers with core and support services for the DFMS to function. Learn more about technologies
in support containers from [here](#technologies).

## Services

There are two types of services in FileShard service pool, where **Core Services** were built to provide main
functionalities (i.e., All the file handling functions, traffic-routing, cluster maintenance etc.) of the DFMS, **Helper
Services** _had_ to be implemented as separate services for
a [certain issue](https://moleculer.services/docs/0.14/faq.html#DB-Adapters-moleculer-db) with the current build of
MoleculerJS. These services **does not** contain any Domain logic, as they were implemented just for certain database
manipulations.

***Note:** Only for the sake of reducing overall complexity, the
common [One-Database-per-Service](https://microservices.io/patterns/data/database-per-service.html) model of
microservices is opted-out in the current implementation and all services are using MongoDB collections for data
persistence. Although still the current modules can be easily converted in future to follow the said model, if needed.

### Core Services

- **API** `services/api.service.ts`: API Gateway services
- **FILE** `services/file.service.ts`: File Management service
  in [Master-Slave](https://en.wikipedia.org/wiki/Master/slave_(technology)) cluster architecture. Master elections is
  done using [Bully](https://en.wikipedia.org/wiki/Bully_algorithm) algorithm.

### Helper Services

- **FILE-CHUNK** `services/file-chunk.service.ts`: Manipulate `file_chunk` collection in database.
- **FILE_CHUNK_DUPLICATE** `services/file-chunk-duplicate.service.ts`: Manipulate `file_chunk_duplicate` collection in
  database.

## Mixins

- **DB-MIXINS** `mixins/db.mixins.ts`: Database access mixin for services. Based
  on [moleculer-db](https://github.com/moleculerjs/moleculer-db#readme)

## Technologies

- `Docker`: Deployment platform.
- `MoleculerJS`: Underlying framework for microservice architecture.
- `MongoDB`: Data persistence capabilities.
- `NATS`: Microservice internal transporter.
- `Redis`: Cache service.
- `Traefik`: Reverse proxy in microservice architecture.

## Useful links

* Moleculer website: https://moleculer.services/
* Moleculer Documentation: https://moleculer.services/docs/0.14/
