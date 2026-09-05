export class ModelDiscovery{
    constructor(provider){
        this.provider = provider;
    }

    async discover(){
        throw new Erro(
            `${this.provider.name} does not implement model discovery`
        );
    }
}