const express = require('express')
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const { swaggerSpec } = require('./lib/swagger')


const indexRouter = require('./routes/index')
const usersRouter = require('./routes/users')
const errorRouter = require('./routes/error')
const { describe } = require('node:test')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ tetended: true }))


app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use('/', indexRouter)
app.use('/users', usersRouter)

app.use(errorRouter)

module.exports = app