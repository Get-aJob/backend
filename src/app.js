const express = require('express')
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')

const indexRouter = require('./routes/index')
const errorRouter = require('./routes/error')
const { describe } = require('node:test')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ tetended: true }))

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

app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use('/', indexRouter)

app.use(errorRouter)

module.exports = app