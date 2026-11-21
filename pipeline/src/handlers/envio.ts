import { map } from "rxjs";
import { Barramento } from "../infra/barramento";
import { Processamento, tentar } from "../infra/processamento";
import { Transportadora } from "../infra/servicos";

export function iniciarEnvio(
    barramento: Barramento,
    processamento: Processamento,
    transporte: Transportadora,
) {
    return processamento.consumir(["EstoqueReservado"], 5, ({ pedido }) =>
        tentar(() => transporte.agendar(pedido)).pipe(
            map(rastreio => barramento.emitir({ tipo: "EnvioAgendado", pedido, rastreio })),
        ),
    );
}
