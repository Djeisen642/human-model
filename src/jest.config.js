module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2015',
      },
      module: { type: 'commonjs' },
    }],
  },
};