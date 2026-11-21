import { catchError, map, of } from "rxjs";
import { Barramento } from "../infra/barramento";
import { Processamento, tentar } from "../infra/processamento";
import { GatewayPagamento, ResultadoCobranca } from "../infra/servicos";

export function iniciarPagamento(
    barramento: Barramento,
    processamento: Processamento,
    gateway: GatewayPagamento,
) {
    return processamento.consumir(["PedidoCriado", "EstoqueInsuficiente"], 5, evento => {
        const { pedido } = evento;
        if (evento.tipo === "EstoqueInsuficiente") {
            const { cobrancaId } = evento;
            return tentar(() => gateway.estornar(pedido, cobrancaId)).pipe(
                map(() => barramento.emitir({ tipo: "PagamentoEstornado", pedido, cobrancaId })),
            );
        }

        return tentar(() => gateway.cobrar(pedido)).pipe(
            catchError(() => of<ResultadoCobranca | "falha-tecnica">("falha-tecnica")),
            map(resultado => {
                if (resultado === "falha-tecnica" || !resultado.aprovado) {
                    const motivo = resultado === "falha-tecnica" ? resultado : "negocio";
                    barramento.emitir({ tipo: "PagamentoRecusado", pedido, motivo });
                    return;
                }
                barramento.emitir({ tipo: "PagamentoAprovado", pedido, cobrancaId: resultado.cobrancaId });
            }),
        );
    });
}
