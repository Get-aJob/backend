const swaggerUi = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')

// Swagger 설정
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JOB-MOA SEC API',
      version: '1.0.0',
      description: '취업모아 프로젝트'
    }
  },
  apis: ['./src/routes/*.js'], // JSDoc 주석을 읽어올 파일 경로
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

module.exports = {
  swaggerSpec
}