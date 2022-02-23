/**
 * Turn a tree from the parser into a simple string format like PromQL(Expr(FunctionCall(...))) same as the way
 * tests are written.
 * @param tree
 * @returns {string|undefined}
 */
export function treeToString(tree) {
    let actual = ''
    tree.iterate({
        enter(type, start) {
            if (!type.name) return
            if (actual.length > 1 && actual.charAt(actual.length - 1) !== '(') {
                // This is a case where we have sibling tokens so lets separate them,
                actual += ', '
            }
            actual += type.name + '('
            return undefined
        },
        leave(type, start) {
            if (actual.charAt(actual.length - 1) === '(') {
                // In case token is empty (no children) we don't want to render empty '()'
                actual = actual.substring(0, actual.length - 1)
            } else {
                actual += ')'
            }
        }
    })
    return actual;
}

/**
 * Returns a line context for the given file.
 *
 * @param {string} file
 * @param {number} index
 */
function toLineContext(file, index) {
    const endEol = file.indexOf('\n', index + 80);
    const endIndex = endEol === -1 ? file.length : endEol;
    return file.substring(index, endIndex).split(/\n/).map(str => '  | ' + str).join('\n');
}

export function fileTests(file, fileName) {
    let caseExpr = /\s*#\s*(.*)(?:\r\n|\r|\n)([^]*?)==+>([^]*?)(?:$|(?:\r\n|\r|\n)+(?=#))/gy
    let tests = []
    let lastIndex = 0;
    for (;;) {
        let m = caseExpr.exec(file)
        if (!m) throw new Error(`Unexpected file format in ${fileName} around\n\n${toLineContext(file, lastIndex)}`)

        let [, name, configStr] = /(.*?)(\{.*?\})?$/.exec(m[1])
        let config = configStr ? JSON.parse(configStr) : null

        let text = m[2].trim(), expected = m[3].trim()
        tests.push({
            name,
            run(parser) {
                parser = parser.configure({strict: false, ...config})
                const actual = treeToString(parser.parse(text))
                const expectedNormalized = normalizeExpect(expected)

                if (actual !== expectedNormalized) {
                    const num = getDiffIndex(expectedNormalized, actual)
                    let message = `\nExpected: ${expectedNormalized}`
                    const prefixLength = 10
                    message += '\n' + ' '.repeat(num + prefixLength) + '^'
                    message += `\nActual:   ${actual}`
                    throw new Error(message)
                }
            }
        })
        lastIndex = m.index + m[0].length
        if (lastIndex == file.length) break
    }
    return tests
}

/**
 * Do a normalization so the tests can be written in more readable form (like new lines and white space) and turn
 * it into single line string which can be more easily compared with actual output.
 * @param expected
 * @returns {string}
 */
function normalizeExpect(expected) {
    return expected.split('\n').map(s => s.trim()).join('').replace(/,(\S)/g,', $1')
}

/**
 * Get the index at which strings starts to be different.
 * @param s1
 * @param s2
 * @returns {number}
 */
function getDiffIndex(s1, s2) {
    const length = Math.min(s1.length, s2.length)
    let i = 0
    for (;i < length; i++) {
        if (s1.charAt(i) !== s2.charAt(i)) {
            break
        }
    }
    return i
}