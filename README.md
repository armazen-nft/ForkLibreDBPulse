# ForkLibreDBPulse

Pulse Net Conection Proof of Energy

Base do projeto **AI OUT OF BOX**, derivada do [LibreDB Studio](https://github.com/libredb/libredb-studio), com código completo e histórico preservados.

## Estado desta entrega

- Base: LibreDB Studio 0.16.0, commit `1039c1d45032e024e698136cd8ca7c1ad981dc62`.
- Editor SQL, provedores, agente, visualizações, administração e configurações de distribuição preservados.
- PoE/SBL: proposta documentada; ainda não implementada ou integrada.
- Build, testes de aplicação e conexões reais de banco não foram executados nesta importação.

Consulte o [README original completo](README-LIBREDB.md) para funcionalidades e instalação. O projeto declara Node.js >=24 e Bun 1.4.2. Preserve package.json, tsconfig.json e bun.lock.

Para usar o agente da base importada, consulte o [guia do agente](docs/AGENT_GUIDE.md).

O [mapa de utilidades e diagnóstico PoE/SBL](docs/AI-OUT-OF-BOX.md) descreve a extensão proposta e as correções necessárias. Energia informada ou estimada não equivale a consumo elétrico medido.

## Bancos da base LibreDB

A tabela lista os provedores da base importada. Consulte [os detalhes por provedor](README-LIBREDB.md#supported-databases) para recursos, limites e compatibilidade.

| Banco | Driver ou protocolo |
| :--- | :--- |
| **PostgreSQL** | `pg` |
| **MySQL** | `mysql2` |
| **Oracle** | `oracledb` (Thin mode) |
| **SQL Server** | `mssql` (tedious) |
| **SQLite** | `bun:sqlite` / `node:sqlite` (runtime-selected) |
| **libSQL** | none — HTTP (the Hrana protocol, `POST /v2/pipeline`, port 8080) |
| **DuckDB** | `@duckdb/node-api` (a native N-API addon, ~68 MB of platform bindings) |
| **MongoDB** | `mongodb` |
| **Couchbase** | none — HTTP (Query + management REST) |
| **ClickHouse** | none — HTTP (SQL interface, port 8123) |
| **Apache Druid** | none — HTTP (`POST /druid/v2/sql`, Router port 8888 or Broker 8082) |
| **Elasticsearch** | none — HTTP (`POST /_sql?format=json`, port 9200) |
| **OpenSearch** | none — HTTP (`POST /_plugins/_sql`, port 9200) |
| **Apache Trino** | none — HTTP (the client protocol, `POST /v1/statement`, port 8080) |
| **Apache Cassandra** | `cassandra-driver` (pure JS, no native module) |
| **Redis** | `ioredis` |

## Instalação e execução

Os canais abaixo distribuem o **LibreDB Studio upstream**, não um build deste fork. Para executar este checkout, siga o [guia de desenvolvimento da base](README-LIBREDB.md) com Node.js 24 ou superior e Bun 1.4.2.

| Canal | Comando upstream |
| :--- | :--- |
| **Docker** | `docker run -p 3000:3000 ghcr.io/libredb/libredb-studio:latest` |
| **Helm (Kubernetes)** | `helm install libredb oci://ghcr.io/libredb/charts/libredb-studio` |
| **npx** | `npx @libredb/studio` |
| **Homebrew** | `brew trust libredb/tap && brew install libredb/tap/libredb-studio` |
| **deb / rpm** | `sudo dpkg -i libredb-studio_<version>_amd64.deb` |
| **Snap** | `sudo snap install libredb-studio` |
| **winget (Windows)** | `winget install LibreDB.Studio` |
| **Chocolatey (Windows)** | `choco install libredb-studio` |
| **Portable zip (Windows)** | `.\libredb-studio.exe` |
| **Desktop app (Linux, AppImage)** | `chmod +x libredb-studio-desktop-<version>-linux-x64.AppImage && ./libredb-studio-desktop-<version>-linux-x64.AppImage` |
| **Desktop app (Debian/Ubuntu)** | `sudo apt install ./libredb-studio-desktop-<version>_amd64.deb` |
| **Desktop app (Flatpak)** | `flatpak --user remote-add --if-not-exists flatpark https://dl.flatpark.org/flatpark.flatpakrepo`<br>`flatpak --user install flatpark org.libredb.Studio` |

> Prefira HTTPS para acessos fora de localhost. Se o navegador acessa o Studio deliberadamente por HTTP sem TLS em uma rede local confiável, configure `AUTH_COOKIE_SECURE=false` para evitar um loop no login. Não desative o atributo Secure quando o acesso usar HTTPS, inclusive com TLS terminado em um proxy.

### Koyeb (imagem upstream)

O botão não implanta este fork. Antes de iniciar a implantação, substitua as senhas e o `JWT_SECRET` pelos seus próprios valores fortes. Os valores preenchidos no link são apenas marcadores; o segredo curto é rejeitado na inicialização. Consulte as [instruções de implantação](README-LIBREDB.md#one-click-deploy).

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=libredb-studio&type=docker&image=ghcr.io%2Flibredb%2Flibredb-studio%3Alatest&instance_type=free&regions=fra&instances_min=0&autoscaling_sleep_idle_delay=3900&env%5BADMIN_EMAIL%5D=admin%40libredb.org&env%5BADMIN_PASSWORD%5D=set_a_real_password&env%5BJWT_SECRET%5D=set_a_real_secret&env%5BLLM_API_KEY%5D=your_GEMINI_API_KEY&env%5BLLM_MODEL%5D=gemini-2.5-flash&env%5BLLM_PROVIDER%5D=gemini&env%5BNEXT_PUBLIC_AUTH_PROVIDER%5D=local&env%5BSTORAGE_PROVIDER%5D=local&env%5BUSER_EMAIL%5D=user%40libredb.org&env%5BUSER_PASSWORD%5D=set_a_real_password&ports=3000%3Bhttp%3B%2F&hc_protocol%5B3000%5D=tcp&hc_grace_period%5B3000%5D=5&hc_interval%5B3000%5D=30&hc_restart_limit%5B3000%5D=3&hc_timeout%5B3000%5D=5&hc_path%5B3000%5D=%2F&hc_method%5B3000%5D=get)

## Licenças e origem

O código importado permanece sob a [licença MIT original](LICENSE), copyright 2025 LibreDB. A [licença Apache 2.0 inicialmente presente neste repositório](LICENSE-PULSE) foi preservada separadamente; ela não substitui os avisos e a licença do código LibreDB. Nenhuma implementação nova de PoE acompanha esta importação.

## Atualizações

Configure https://github.com/libredb/libredb-studio.git como remoto upstream para acompanhar a origem. Revise futuras integrações antes de atualizar a base; esta entrega preserva o snapshot identificado acima.
