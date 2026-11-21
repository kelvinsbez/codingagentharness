import { map } from "rxjs";
import { Barramento } from "../infra/barramento";
import { Processamento, tentar } from "../infra/processamento";
import { ControleEstoque } from "../infra/servicos";

export function iniciarEstoque(
    barramento: Barramento,
    processamento: Processamento,
    estoque: ControleEstoque,
) {
    return processamento.consumir(["PagamentoAprovado"], 1, ({ pedido, cobrancaId }) =>
        tentar(() => estoque.reservar(pedido)).pipe(
            map(resultado => {
                if (resultado === "reservado") {
                    barramento.emitir({ tipo: "EstoqueReservado", pedido });
                } else {
                    barramento.emitir({ tipo: "EstoqueInsuficiente", pedido, cobrancaId });
                }
            }),
        ),
    );
}
