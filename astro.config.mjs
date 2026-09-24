// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Helper to generate sidebar items for a version
function versionSidebar(version) {
  return [
    { label: 'Introducao', autogenerate: { directory: `${version}/introducao` } },
    { label: 'Arquitetura', autogenerate: { directory: `${version}/arquitetura` } },
    { label: 'Modulos', autogenerate: { directory: `${version}/modulos` } },
    { label: 'Funcionalidades', autogenerate: { directory: `${version}/funcionalidades` } },
    { label: 'Infraestrutura', autogenerate: { directory: `${version}/infraestrutura` } },
    { label: 'Changelog', autogenerate: { directory: `${version}/changelog` } },
    { label: 'Versionamento', autogenerate: { directory: `${version}/versionamento` } },
  ];
}

export default defineConfig({
  integrations: [
    starlight({
      title: 'Despensinha ERP - Dev Docs',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'Portugues',
          lang: 'pt-BR',
        },
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Despensinha' }],
      components: {
        Header: './src/components/Header.astro',
      },
      sidebar: [
        {
          label: 'latest',
          collapsed: true,
          items: versionSidebar('latest'),
        },
        {
          label: 'v1-27-1',
          collapsed: true,
          items: versionSidebar('v1-27-1'),
        },
        {
          label: 'v1-27-2',
          collapsed: true,
          items: versionSidebar('v1-27-2'),
        },
        {
          label: 'v1-31-0',
          collapsed: true,
          items: versionSidebar('v1-31-0'),
        },
        {
          label: 'v1-32-0',
          collapsed: true,
          items: versionSidebar('v1-32-0'),
        },
        // SNAPSHOT_INSERT_ABOVE
      ],
    }),
  ],
});
