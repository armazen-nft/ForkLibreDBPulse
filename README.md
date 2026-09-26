# ForkLibreDBPulse

Pulse Net Conection Proof of Energy

Base do projeto **AI OUT OF BOX**, derivada do [LibreDB Studio](https://github.com/libredb/libredb-studio), com código completo e histórico preservados.

## Estado desta entrega

- Base: LibreDB Studio 0.16.0, commit `1039c1d45032e024e698136cd8ca7c1ad981dc62`.
- Editor SQL, provedores, agente, visualizações, administração e configurações de distribuição preservados.
- PoE/SBL: proposta documentada; ainda não implementada ou integrada.
- Build, testes de aplicação e conexões reais de banco não foram executados nesta importação.

Consulte o [README original completo](README-LIBREDB.md) para funcionalidades e instalação. O projeto declara Node.js >=24 e Bun 1.4.2. Preserve package.json, tsconfig.json e bun.lock.

O [mapa de utilidades e diagnóstico PoE/SBL](docs/AI-OUT-OF-BOX.md) descreve a extensão proposta e as correções necessárias. Energia informada ou estimada não equivale a consumo elétrico medido.

## Licenças e origem

O código importado permanece sob a [licença MIT original](LICENSE), copyright 2025 LibreDB. A [licença Apache 2.0 inicialmente presente neste repositório](LICENSE-PULSE) foi preservada separadamente; ela não substitui os avisos e a licença do código LibreDB. Nenhuma implementação nova de PoE acompanha esta importação.

## Atualizações

Configure https://github.com/libredb/libredb-studio.git como remoto upstream para acompanhar a origem. Revise futuras integrações antes de atualizar a base; esta entrega preserva o snapshot identificado acima.
