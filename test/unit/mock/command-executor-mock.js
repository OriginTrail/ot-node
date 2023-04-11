class CommandExecutorMock {
    constructor() {
        this.addCommandList = [];
    }

    add(addCommand) {
        this.addCommandList.push(addCommand);
    }
}

export default CommandExecutorMock;
