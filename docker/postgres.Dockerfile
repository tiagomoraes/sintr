# syntax=docker/dockerfile:1.7
# Postgres for sintr: the official Alpine image the stack has always run,
# plus pgvector (the memory's vectors, DECISIONS 118), compiled here. The
# same Postgres on the same C library, so a data volume made by
# postgres:16-alpine opens as it was and its text indexes stay valid; the
# pgvector images are Debian, whose glibc sorts text differently
# (docs/SELFHOST.md, "Upgrading to the memory").

ARG POSTGRES_MAJOR=16

FROM postgres:${POSTGRES_MAJOR}-alpine
# A release tag, checked against its commit: the source is what was reviewed.
ARG PGVECTOR_VERSION=0.8.7
ARG PGVECTOR_COMMIT=f37c13f68b57d2c3472b2214fbcff699d6d34876
# with_llvm=no: no JIT bitcode (the image's clang is not installed); OPTFLAGS="": no
# -march=native, so an image built on one machine runs on another.
RUN set -eux; \
    apk add --no-cache --virtual .pgvector-build build-base git; \
    git clone --quiet --depth 1 --branch "v${PGVECTOR_VERSION}" https://github.com/pgvector/pgvector.git /tmp/pgvector; \
    test "$(git -C /tmp/pgvector rev-parse HEAD)" = "${PGVECTOR_COMMIT}"; \
    make -C /tmp/pgvector with_llvm=no OPTFLAGS=""; \
    make -C /tmp/pgvector with_llvm=no install; \
    rm -rf /tmp/pgvector; \
    apk del .pgvector-build
