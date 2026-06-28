import React, { useCallback, useMemo, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { cloneDeep } from 'lodash';
import * as FileSaver from 'file-saver';
import jsyaml from 'js-yaml';
import jsesc from 'jsesc';
import toast from 'react-hot-toast';
import { IconBook, IconCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons';

import Modal from 'components/Modal';
import Portal from 'components/Portal';
import StyledWrapper from './StyledWrapper';
import demoImage from './demo.png';
import CollectionVersionInfo from './CollectionVersionInfo';
import EnvironmentSelectionList from './EnvironmentSelectionList';
import { useApp } from 'providers/App';
import { transformCollectionToSaveToExportAsFile, findCollectionByUid, areItemsLoading, sortItemsBySidebarOrder, getCollectionItemCounts } from 'utils/collections/index';
import { brunoToOpenCollection } from '@usebruno/converters';
import { sanitizeName } from 'utils/common/regex';
import { escapeHtml } from 'utils/response';

const CDN_BASE_URL = 'https://cdn.opencollection.com';

const FEATURES = [
  'Standalone HTML file - no server required',
  'Interactive API playground',
  'Host on any static file server'
];

const buildHtmlDocument = (collectionName, escapedYamlContent) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collectionName} - API Documentation</title>
    <style>
        body { margin: 0; padding: 0; }
        #opencollection-container { width: 100vw; height: 100vh; }
    </style>
    <link rel="stylesheet" href="${CDN_BASE_URL}/docs.css">
    <script src="${CDN_BASE_URL}/docs.js"></script>
</head>
<body>
    <div id="opencollection-container"></div>
    <script>
        const collectionData = ${escapedYamlContent};
        new window.OpenCollection({
            target: document.getElementById('opencollection-container'),
            opencollection: collectionData,
            theme: 'light'
        });
    </script>
</body>
</html>`;

const CollectionNotFound = ({ onClose }) => {
  const { t } = useTranslation();
  return (
    <Portal>
      <Modal size="md" title={t('SIDEBAR.GENERATE_DOCUMENTATION')} confirmText={t('COMMON.CLOSE')} handleConfirm={onClose} hideCancel>
        <StyledWrapper className="w-[500px]">
          <div className="flex items-center gap-2 text-warning">
            <IconAlertTriangle size={16} className="shrink-0" />
            <span>{t('SIDEBAR.COLLECTION_NOT_AVAILABLE')}</span>
          </div>
        </StyledWrapper>
      </Modal>
    </Portal>
  );
};

const GenerateDocumentation = ({ onClose, collectionUid }) => {
  const { t } = useTranslation();
  const { version } = useApp();
  const collection = useSelector((state) =>
    findCollectionByUid(state.collections.collections, collectionUid)
  );

  const isLoading = useMemo(
    () => (collection ? areItemsLoading(collection) : false),
    [collection]
  );

  // The collection's current version (read-only here); formatted for display below.
  const currentVersion = collection?.version;

  // Folder + request counts, computed from the collection tree (recursively).
  const { folderCount, requestCount } = useMemo(
    () => getCollectionItemCounts(collection?.items),
    [collection?.items]
  );

  const environments = useMemo(() => collection?.environments || [], [collection?.environments]);

  // Track *deselected* environments so all environments — including any that load
  // after mount — stay selected by default, matching the design.
  const [deselectedEnvUids, setDeselectedEnvUids] = useState(() => new Set());
  const selectedEnvUids = useMemo(
    () => environments.filter((env) => !deselectedEnvUids.has(env.uid)).map((env) => env.uid),
    [environments, deselectedEnvUids]
  );

  const toggleEnv = useCallback((uid) => {
    setDeselectedEnvUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  // Select all -> nothing deselected; deselect all -> every environment deselected.
  const toggleAllEnvs = useCallback(
    (selectAll) => setDeselectedEnvUids(selectAll ? new Set() : new Set(environments.map((env) => env.uid))),
    [environments]
  );

  const handleGenerate = useCallback(() => {
    try {
      const collectionCopy = cloneDeep(collection);

      // Order items exactly like the Sidebar tree (folders by seq, then requests by seq
      // ) at every depth, so the generated docs match the collection shown in the sidebar.
      collectionCopy.items = sortItemsBySidebarOrder(collectionCopy.items);

      // Only include the environments the user kept selected in the generated docs.
      const selectedSet = new Set(selectedEnvUids);
      collectionCopy.environments = (collectionCopy.environments || []).filter((env) => selectedSet.has(env.uid));

      const transformedCollection = transformCollectionToSaveToExportAsFile(collectionCopy);
      const openCollection = brunoToOpenCollection(transformedCollection);

      // The docs are generated from the current collection version (when set).
      if (currentVersion) {
        openCollection.info = {
          ...openCollection.info,
          version: currentVersion
        };
      }

      openCollection.extensions = {
        ...openCollection.extensions,
        bruno: {
          ...openCollection.extensions?.bruno,
          exportedAt: new Date().toISOString(),
          exportedUsing: version ? `Bruno/${version}` : 'Bruno'
        }
      };

      const yamlContent = jsyaml.dump(openCollection, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });

      // jsesc handles all edge cases: Unicode, special chars, quotes, template literals, etc.
      let escapedYaml = jsesc(yamlContent, { quotes: 'double', wrap: true });

      // Escape closing tags to prevent HTML parser from breaking out of the script block
      escapedYaml = escapedYaml.replace(/<\//g, '<\\/');

      const htmlContent = buildHtmlDocument(
        escapeHtml(collection.name),
        escapedYaml
      );

      const fileName = `${sanitizeName(collection.name)}-documentation.html`;
      FileSaver.saveAs(new Blob([htmlContent], { type: 'text/html' }), fileName);

      toast.success(t('SIDEBAR.DOCS_GENERATED_SUCCESS'));
      onClose();
    } catch (error) {
      console.error('Error generating documentation:', error);
      toast.error(t('SIDEBAR.FAILED_TO_GENERATE_DOCS'));
    }
  }, [collection, version, onClose, t, currentVersion, selectedEnvUids]);

  if (!collection) {
    return <CollectionNotFound onClose={onClose} />;
  }

  return (
    <Portal>
      <Modal
        size="md"
        title={t('SIDEBAR.GENERATE_DOCUMENTATION')}
        confirmText={isLoading ? t('COMMON.LOADING') : t('COMMON.CREATE')}
        cancelText={t('COMMON.CANCEL')}
        handleConfirm={isLoading ? undefined : handleGenerate}
        handleCancel={onClose}
        confirmDisabled={isLoading}
      >
        <StyledWrapper className="w-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <IconLoader2 size={20} className="animate-spin" />
              <span>{t('SIDEBAR.LOADING_COLLECTION')}</span>
            </div>
          ) : (
            <div className="content">
              <h3 className="title flex items-center gap-2 mt-2 font-medium">
                <IconBook size={18} />
                <span>{t('SIDEBAR.INTERACTIVE_API_DOCS')}</span>
              </h3>
              <p className="description mb-4">
                {t('SIDEBAR.GENERATE_DOCS_DESC')}
              </p>

              <div className="preview-container relative mb-4">
                <span className="preview-label absolute">{t('SIDEBAR.SAMPLE_OUTPUT')}</span>
                <img src={demoImage} alt={t('SIDEBAR.DOCUMENTATION_PREVIEW')} className="preview-image" />
              </div>

              <ul className="features flex flex-col list-none gap-2 p-0 mb-4">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <IconCheck size={16} className="check-icon flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="config-card mb-4">
                <CollectionVersionInfo version={currentVersion} folderCount={folderCount} requestCount={requestCount} />
                {environments.length > 0 && (
                  <Fragment>
                    <div className="card-divider" />
                    <div className="env-section">
                      <EnvironmentSelectionList
                        title="Environments to include"
                        environments={environments}
                        selectedUids={selectedEnvUids}
                        onToggle={toggleEnv}
                        onToggleAll={toggleAllEnvs}
                      />
                    </div>
                  </Fragment>
                )}
              </div>

              <p className="note m-0">
                {t('SIDEBAR.DOCS_CDN_NOTE')}
              </p>
            </div>
          )}
        </StyledWrapper>
      </Modal>
    </Portal>
  );
};

export default GenerateDocumentation;
