import { buildSchema } from 'graphql';
import { GraphbackPluginEngine } from '@graphback/core';
import { ResolversCRUDPlugin } from '../src/ResolversCRUDPlugin';

const schema = buildSchema(`
"""
@model
"""
type Todos {
 id: ID!
 text: String
}

"""
@model
"""
type User {
  name: String
  """
  @id
  """
  username: String
}
`);


test('creates resolvers for models', async ()  => {
  const pluginEngine = new GraphbackPluginEngine({schema, plugins: [
    new ResolversCRUDPlugin()
  ]})

  const metadata = pluginEngine.createResources()

  expect(metadata.getResolvers()).toMatchSnapshot();
});

