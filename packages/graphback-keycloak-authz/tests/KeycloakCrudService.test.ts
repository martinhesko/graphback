
import Keycloak from 'keycloak-connect'
import { KeycloakContextBase } from 'keycloak-connect-graphql'
import { PubSub } from 'graphql-subscriptions'
import { buildSchema, GraphQLObjectType } from 'graphql'
import { KeycloakCrudService } from '../src'
import { MockDataProvider } from './mocks/MockDataProvider'

const subscriptionConfig = {
  subCreate: true,
  subUpdate: true,
  subDelete: true
}

const pubSub = new PubSub()

// returned from CRUDService.findBy
// if tests ever start failing because of this,
// something probably changed in the CRUDService implementation
// around paging
const emptyPageValue = { items: [], offset: 0 }

test('unauthorized tokens will result in unauthorized errors', async () => {

  const modelType = buildSchema(`
    type Task {
      id: ID
      title: String
      description: String
    }
  `).getType('Task') as GraphQLObjectType

  const authConfig = {
    create: { roles: ['admin'] },
    read: { roles: ['admin'] },
    update: { roles: ['admin'] },
    delete: { roles: ['admin'] }
  }

  const db = new MockDataProvider()

  const service = new KeycloakCrudService({
    db,
    authConfig,
    pubSub,
    crudOptions: subscriptionConfig,
    modelType
  })

  const unauthorizedToken = {
    hasRole: (role: string) => {
      return false
    },
    isExpired: () => {
      return false
    }
  } as Keycloak.Token

  const unauthorizedContext = { kauth: new KeycloakContextBase(unauthorizedToken) }

  const val = { test: 'value' }

  const dbCreateSpy = jest.spyOn(db, "create")
  const dbUpdateSpy = jest.spyOn(db, "update")
  const dbDeleteSpy = jest.spyOn(db, "delete")
  const dbfindBySpy = jest.spyOn(db, "findBy")
  const dbFindOneSpy = jest.spyOn(db, "findOne")

  expect(() => service.create(val, unauthorizedContext)).toThrowError('User is not authorized.')
  expect(() => service.update(val, unauthorizedContext)).toThrowError('User is not authorized.')
  expect(() => service.delete(val, unauthorizedContext)).toThrowError('User is not authorized.')
  expect(() => service.findBy(val, null, null, unauthorizedContext)).toThrowError('User is not authorized.')
  expect(() => service.findOne(val, unauthorizedContext)).toThrowError('User is not authorized.')

  // verify that no calls to the underlying data provider were made
  expect(dbCreateSpy).not.toHaveBeenCalled()
  expect(dbUpdateSpy).not.toHaveBeenCalled()
  expect(dbDeleteSpy).not.toHaveBeenCalled()
  expect(dbfindBySpy).not.toHaveBeenCalled()
  expect(dbFindOneSpy).not.toHaveBeenCalled()
});

test('authorized tokens will not throw an error and will get a result', async () => {

  const modelType = buildSchema(`
    type Task {
      id: ID
      title: String
      description: String
    }
  `).getType('Task') as GraphQLObjectType

  const authConfig = {
    create: { roles: ['admin'] },
    read: { roles: ['admin'] },
    update: { roles: ['admin'] },
    delete: { roles: ['admin'] }
  }

  const db = new MockDataProvider()

  const service = new KeycloakCrudService({
    db,
    authConfig,
    pubSub,
    crudOptions: subscriptionConfig,
    modelType
  })

  const authorizedToken = {
    hasRole: (role: string) => {
      return role === 'admin'
    },
    isExpired: () => {
      return false
    }
  } as Keycloak.Token


  const authorizedContext = { kauth: new KeycloakContextBase(authorizedToken) }

  const dbCreateSpy = jest.spyOn(db, "create")
  const dbUpdateSpy = jest.spyOn(db, "update")
  const dbDeleteSpy = jest.spyOn(db, "delete")
  const dbfindBySpy = jest.spyOn(db, "findBy")
  const dbFindOneSpy = jest.spyOn(db, "findOne")

  const val = { test: 'value' }

  await expect(service.create(val, authorizedContext)).resolves.toEqual(val)
  await expect(service.update(val, authorizedContext)).resolves.toEqual(val)
  await expect(service.delete(val, authorizedContext)).resolves.toEqual(val)
  await expect(service.findBy(val, null, null, authorizedContext)).resolves.toEqual(emptyPageValue)
  await expect(service.findOne(val, authorizedContext)).resolves.toEqual(val)

  // verify that the calls to the underlying data provider were made
  expect(dbCreateSpy).toHaveBeenCalled()
  expect(dbUpdateSpy).toHaveBeenCalled()
  expect(dbDeleteSpy).toHaveBeenCalled()
  expect(dbfindBySpy).toHaveBeenCalled()
  expect(dbFindOneSpy).toHaveBeenCalled()
});


test('passing no authConfig will result in all operations being allowed', async () => {

  const modelType = buildSchema(`
    type Task {
      id: ID
      title: String
      description: String
    }
  `).getType('Task') as GraphQLObjectType

  const authConfig = undefined

  const db = new MockDataProvider()

  const service = new KeycloakCrudService({
    db,
    authConfig,
    pubSub,
    crudOptions: subscriptionConfig,
    modelType
  })

  const context = { kauth: {} }
  const val = { test: 'value' }

  await expect(service.create(val, context)).resolves.toEqual(val)
  await expect(service.update(val, context)).resolves.toEqual(val)
  await expect(service.delete(val, context)).resolves.toEqual(val)
  await expect(service.findBy(val, null, null, context)).resolves.toEqual(emptyPageValue)
  await expect(service.findOne(val, context)).resolves.toEqual(val)
});

test('multiple roles can be applied to each operation', async () => {

  const modelType = buildSchema(`
    type Task {
      id: ID
      title: String
      description: String
    }
  `).getType('Task') as GraphQLObjectType

  const authConfig = {
    create: { roles: ['admin', 'developer', 'user'] },
    read: { roles: ['admin', 'developer', 'user'] },
    update: { roles: ['admin', 'developer'] },
    delete: { roles: ['admin', 'developer'] }
  }

  const service = new KeycloakCrudService({
    db: new MockDataProvider(),
    authConfig,
    pubSub,
    crudOptions: subscriptionConfig,
    modelType
  })

  const Token = {
    hasRole: (role: string) => {
      return role === 'user'
    },
    isExpired: () => {
      return false
    }
  } as Keycloak.Token

  const context = { kauth: new KeycloakContextBase(Token) }

  const val = { test: 'value' }

  await expect(service.create(val, context)).resolves.toEqual(val)
  expect(() => service.update(val, context)).toThrowError('User is not authorized.')
  expect(() => service.delete(val, context)).toThrowError('User is not authorized.')
  await expect(service.findBy(val, null, null, context)).resolves.toEqual(emptyPageValue)
  await expect(service.findOne(val, context)).resolves.toEqual(val)
});
