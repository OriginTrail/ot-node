class CommandExecutorMock {
    async add(addCommand) {
        console.log('Operation id:', addCommand.data.operationId);
        console.log('Leftover nodes:', addCommand.data.leftoverNodes);
    }
}

export default CommandExecutorMock;
