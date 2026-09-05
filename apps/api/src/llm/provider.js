export class LLMProvider{
    constructor({ name, models = []}) {
        this.name = name;
        this.models = models;
    }

    supports(model){
        return this.models.includes(model);
    }

    async generate(){
        throw new Error(
            `${this.name} provider does not implement the generate method`
        );
    }
}