class CommandExecutorMock {
    async add(addCommand, addDelay = 0, insert = true) {
        console.log(addDelay, insert);
        console.log('Operation id:', addCommand.data.operationId);
        console.log('Leftover nodes:', addCommand.data.leftoverNodes);
    }
}

export default CommandExecutorMock;
