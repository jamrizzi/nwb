// @flow
import assert from 'assert'

import webpack from 'webpack'

import { createServeConfig } from './appCommands'
import { getProjectType } from './config'
import { INFERNO_APP, PREACT_APP, REACT_APP, WEB_APP } from './constants'
import createServerWebpackConfig from './createServerWebpackConfig'
import debug from './debug'
import { deepToString, joinAnd } from './utils'

const APP_TYPE_CONFIG = {
  [INFERNO_APP]: './inferno',
  [PREACT_APP]: './preact',
  [REACT_APP]: './react',
  [WEB_APP]: './web',
}

/**
 * Express middleware for serving an app with hot reloading - equivalent to
 * having run `nwb serve`, but from your own server.
 */
export default function nwbMiddleware(express: Object, options: Object = {}) {
  assert(
    express && typeof express.Router === 'function',
    'The express module must be passed as the first argument to nwb middleware'
  )

  let projectType = options.type
  if (projectType == null) {
    projectType = getProjectType({ _: ['serve'], config: options.config })
  }
  if (!APP_TYPE_CONFIG[projectType]) {
    throw new Error(
      `nwb Express middleware is unable to handle '${projectType}' projects, only ${
      joinAnd(Object.keys(APP_TYPE_CONFIG).map(s => `'${s}'`), 'or')}`
    )
  }

  // Use options to create an object equivalent to CLI args parsed by minimist
  const args = {
    _: [`serve-${projectType}`, options.entry],
    config: options.config,
    hmre: !(options.hmr === false || options.hmre === false),
    install: !!options.install || !!options.autoInstall,
    reload: !!options.reload
  }

  const appTypeConfig = require(APP_TYPE_CONFIG[projectType])(args)

  const webpackConfig = createServerWebpackConfig(
    args,
    createServeConfig(args, appTypeConfig.getServeConfig(), {
      plugins: {
        status: {
          disableClearConsole: true,
          successMessage: null,
        }
      }
    })
  )

  debug('webpack config: %s', deepToString(webpackConfig))

  const compiler = webpack(webpackConfig)

  const router = express.Router()

  router.use(require('webpack-dev-middleware')(compiler, {
    noInfo: true,
    publicPath: webpackConfig.output.publicPath,
    quiet: true,
    watchOptions: {
      ignored: /node_modules/
    }
  }))

  router.use(require('webpack-hot-middleware')(compiler, {
    log: false
  }))

  return router
}
