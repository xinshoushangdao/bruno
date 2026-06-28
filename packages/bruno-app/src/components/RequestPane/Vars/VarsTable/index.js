import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'providers/Theme';
import { moveVar, setRequestVars } from 'providers/ReduxStore/slices/collections';
import { sendRequest, saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { updateTableColumnWidths } from 'providers/ReduxStore/slices/tabs';
import MultiLineEditor from 'components/MultiLineEditor';
import InfoTip from 'components/InfoTip';
import DataTypeSelector from 'components/DataTypeSelector';
import { valueToString } from '@usebruno/common/utils';
import EditableTable from 'components/EditableTable';
import StyledWrapper from './StyledWrapper';
import toast from 'react-hot-toast';
import { variableNameRegex } from 'utils/common/regex';

const VarsTable = ({ item, collection, vars, varType, initialScroll = 0 }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { storedTheme } = useTheme();
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);

  // Get column widths from Redux
  const focusedTab = tabs?.find((t) => t.uid === activeTabUid);
  const varsWidths = focusedTab?.tableColumnWidths?.['request-vars'] || {};

  const handleColumnWidthsChange = (tableId, widths) => {
    dispatch(updateTableColumnWidths({ uid: activeTabUid, tableId, widths }));
  };

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));
  const handleRun = () => dispatch(sendRequest(item, collection.uid));

  const handleVarsChange = useCallback((updatedVars) => {
    dispatch(setRequestVars({
      collectionUid: collection.uid,
      itemUid: item.uid,
      vars: updatedVars,
      type: varType
    }));
  }, [dispatch, collection.uid, item.uid, varType]);

  const handleVarDrag = useCallback(({ updateReorderedItem }) => {
    dispatch(moveVar({
      type: varType,
      collectionUid: collection.uid,
      itemUid: item.uid,
      updateReorderedItem
    }));
  }, [dispatch, varType, collection.uid, item.uid]);

  const getRowError = useCallback((row, index, key) => {
    if (key !== 'name') return null;
    if (!row.name || row.name.trim() === '') return null;
    if (!variableNameRegex.test(row.name)) {
      return t('REQUEST_PANE.VARIABLE_CONTAINS_INVALID_CHARACTERS');
    }
    return null;
  }, []);

  const columns = [
    {
      key: 'name',
      name: t('REQUEST_PANE.NAME'),
      isKeyField: true,
      placeholder: t('REQUEST_PANE.NAME'),
      width: '35%'
    },
    {
      key: 'value',
      name: varType === 'request' ? t('COMMON.VALUE') : (
        <div className="flex items-center">
          <span>{t('REQUEST_PANE.EXPR')}</span>
          <InfoTip className="tooltip-mod" content={t('REQUEST_PANE.YOU_CAN_WRITE_ANY_VALID_JS_EXPRESSION_HERE')} infotipId={`request-${varType}-var`} />
        </div>
      ),
      placeholder: varType === 'request' ? t('REQUEST_PANE.VALUE') : t('REQUEST_PANE.EXPR'),
      render: ({ row, value, onChange, isLastEmptyRow }) => (
        <div className="flex items-center w-full gap-2">
          <div className="flex-1 min-w-0">
            <MultiLineEditor
              value={valueToString(value)}
              theme={storedTheme}
              onSave={onSave}
              onChange={onChange}
              onRun={handleRun}
              collection={collection}
              item={item}
              placeholder={value == null || (typeof value === 'string' && value.trim() === '') ? (varType === 'request' ? t('REQUEST_PANE.VALUE') : t('REQUEST_PANE.EXPR')) : ''}
            />
          </div>
          {/* DataTypes apply to literal values, not to the JS expression that produces a post-response value. */}
          {!isLastEmptyRow && varType === 'request' && (
            <DataTypeSelector
              variable={row}
              theme={storedTheme}
              collection={collection}
              onChange={(fields) => {
                const updated = (vars || []).map((v) => v.uid === row.uid ? { ...v, ...fields } : v);
                handleVarsChange(updated);
              }}
            />
          )}
        </div>
      )
    }
  ];

  const defaultRow = {
    name: '',
    value: '',
    ...(varType === 'response' ? { local: false } : {})
  };

  return (
    <StyledWrapper className="w-full">
      <EditableTable
        tableId="request-vars"
        testId={`request-vars-${varType === 'response' ? 'res' : 'req'}`}
        columns={columns}
        rows={vars || []}
        onChange={handleVarsChange}
        defaultRow={defaultRow}
        getRowError={getRowError}
        reorderable={true}
        onReorder={handleVarDrag}
        columnWidths={varsWidths}
        onColumnWidthsChange={(widths) => handleColumnWidthsChange('request-vars', widths)}
        initialScroll={initialScroll}
      />
    </StyledWrapper>
  );
};

export default VarsTable;
