class StringUtil {
    toCamelCase(str) {
        return str.replace(/[-_]+(.)/g, (_, group) => group.toUpperCase());
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

const stringUtil = new StringUtil();

export default stringUtil;
