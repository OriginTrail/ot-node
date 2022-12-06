export default function validateArguments(received, expected) {
    for (const arg of expected) {
        if (!received[arg]) {
            return false;
        }
    }
    return true;
}
