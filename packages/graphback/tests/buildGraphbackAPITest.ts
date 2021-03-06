/* eslint-disable import/no-extraneous-dependencies */
import { createKnexDbProvider, CRUDService } from '@graphback/runtime-knex'
import * as Knex from 'knex'
import { buildSchema } from 'graphql'
import { buildGraphbackAPI } from '../src'
import { DataSyncPlugin } from '../../graphback-datasync/src/DataSyncPlugin'

describe('buildGraphbackAPI', () => {

  const setup = () => {
    const db = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:'
      },
      useNullAsDefault: true
    })

    return { db }
  }

  test('Creates a Graphback API using the default configuration with Knex', () => {

    const model = `
    """ @model """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { services, resolvers } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db)
    })

    const { Query, Subscription, Mutation } = resolvers
    expect(Object.keys(Query)).toEqual(['getNote', 'findNotes'])
    expect(Object.keys(Subscription)).toEqual(['newNote', 'updatedNote', 'deletedNote'])
    expect(Object.keys(Mutation)).toEqual(['createNote', 'updateNote', 'deleteNote'])

    expect(Object.keys(services)).toHaveLength(1)
    expect(services.Note instanceof CRUDService)
  })

  test('Disable resolver generation on model', () => {

    const model = `
    """
    @model(findOne: false, delete: false)
    """
    type Note {
      id: ID!
      title: String!
      description: String
    }

    """
    @model(find: false)
    """
    type Comment {
      id: ID!
    }
    `

    const { db } = setup()

    const { resolvers } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db),
      crud: {
        findOne: true,
        update: false
      }
    })

    const { Query, Mutation } = resolvers
    expect(Object.keys(Query)).toEqual(['findNotes', 'getComment'])
    expect(Object.keys(Mutation)).toEqual(['createNote', 'createComment', 'deleteComment'])
  })

  test('Disable delete subscription globally', () => {
    const model = `
    """
    @model
    """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { resolvers } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db),
      crud: {
        subDelete: false
      }
    })

    const { Subscription } = resolvers
    expect(Object.keys(Subscription)).toEqual(['newNote', 'updatedNote'])
  })

  test('Disable create subscription globally', () => {
    const model = `
    """
    @model
    """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { resolvers } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db),
      crud: {
        subCreate: false
      }
    })

    const { Subscription } = resolvers
    expect(Object.keys(Subscription)).toEqual(['updatedNote', 'deletedNote'])
  })

  test('Disable update subscription globally', () => {
    const model = `
    """
    @model
    """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { resolvers } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db),
      crud: {
        subUpdate: false
      }
    })

    const { Subscription } = resolvers
    expect(Object.keys(Subscription)).toEqual(['newNote', 'deletedNote'])
  })

  test('Creates a matching GraphQLSchema object and schema AST', () => {

    const model = `
    """ @model """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { typeDefs, schema } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db)
    })

    expect(buildSchema(typeDefs).astNode).toEqual(schema.astNode)
  })

  test('Custom plugins are executed', () => {

    const model = `
    """
    @model
    @delta
    """
    type Note {
      id: ID!
      title: String!
      description: String
    }
    `

    const { db } = setup()

    const { schema } = buildGraphbackAPI(model, {
      dataProviderCreator: createKnexDbProvider(db),
      plugins: [
        new DataSyncPlugin()
      ]
    })

    expect(schema.getType('NoteDeltaList')).toBeDefined()
  })
})

