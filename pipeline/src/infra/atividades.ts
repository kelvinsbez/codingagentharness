import { BehaviorSubject, filter, firstValueFrom } from "rxjs";

export class Atividades {
    private readonly pendentes = new BehaviorSubject(0);

    registrar(): () => void {
        this.pendentes.next(this.pendentes.value + 1);
        return () => this.pendentes.next(this.pendentes.value - 1);
    }

    async aguardar(): Promise<void> {
        await firstValueFrom(this.pendentes.pipe(filter(total => total === 0)));
    }
}
