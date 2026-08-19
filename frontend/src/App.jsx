import React, { useState, useEffect } from 'react';
import {
  Button, Typography, CircularProgress, MenuItem, Select,
  FormControl, InputLabel, IconButton, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Checkbox, FormGroup, FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import CloudIcon from '@mui/icons-material/Cloud';
import axios from 'axios';

import {
  uploadDataset, fetchFromUrl, connectMySQLDatabases,
  fetchMySQLTables, importMySQLTable, fetchDatasetPreview,
  fetchAnonymizedPreview, downloadMultiDatasetPackage,
  connectSnowflakeDatabases, fetchSnowflakeSchemas, fetchSnowflakeTables, importSnowflakeTable,
  fetchFromS3, exportToS3
} from './services/api';
import DataPreviewTable from './components/DataPreviewTable';

export default function App() {
  const [activeDataset, setActiveDataset] = useState('');
  const [savedWorkspace, setSavedWorkspace] = useState(() => {
    try {
      const cached = localStorage.getItem('saved_workspaces');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [loading, setLoading] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreenTable, setIsFullScreenTable] = useState(false);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(true);
  const [isExecuted, setIsExecuted] = useState(false);

  const [rules, setRules] = useState({});
  const [isAnonymizedView, setIsAnonymizedView] = useState(false);

  // Multi-Platform Database State
  const [dbPlatform, setDbPlatform] = useState(''); 
  const [mysqlCreds, setMysqlCreds] = useState({ host: 'localhost', port: 3306, user: 'root', password: '' });
  const [snowflakeCreds, setSnowflakeCreds] = useState({ account: '', user: '', password: '', warehouse: 'COMPUTE_WH', role: '' });

  const [dbConnected, setDbConnected] = useState(false);
  const [dbList, setDbList] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [schemaList, setSchemaList] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState('');
  const [tableList, setTableList] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);

  // URL State
  const [urlInput, setUrlInput] = useState('');

  // Amazon S3 Ingestion State
  const [s3Creds, setS3Creds] = useState({
    bucket: '',
    key: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: ''
  });

  // AWS Smart Dynamic Dropdown States & Account Modes
  const [awsLoggedIn, setAwsLoggedIn] = useState(false);
  const [awsAccountMode, setAwsAccountMode] = useState('same'); // 'same' or 'different'
  const [awsBuckets, setAwsBuckets] = useState([]);
  const [awsFolders, setAwsFolders] = useState([]);
  const [selectedAwsBucket, setSelectedAwsBucket] = useState('');
  const [selectedAwsFolder, setSelectedAwsFolder] = useState('');
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [loadingAwsBuckets, setLoadingAwsBuckets] = useState(false);

  // Amazon S3 Export State in Download Modal
  const [s3ExportCreds, setS3ExportCreds] = useState({
    bucket: '',
    destinationKey: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: ''
  });

  // Sidebar Collapsible Dropdown States
  const [isSidebarDbOpen, setIsSidebarDbOpen] = useState(false);
  const [isSidebarUrlOpen, setIsSidebarUrlOpen] = useState(false);
  const [isSidebarS3Open, setIsSidebarS3Open] = useState(false);
  const [sbDbPlatform, setSbDbPlatform] = useState('');
  const [sbMysqlCreds, setSbMysqlCreds] = useState({ host: 'localhost', port: 3306, user: 'root', password: '' });
  const [sbSnowflakeCreds, setSbSnowflakeCreds] = useState({ account: '', user: '', password: '', warehouse: 'COMPUTE_WH', role: '' });
  const [sbDbConnected, setSbDbConnected] = useState(false);
  const [sbDbList, setSbDbList] = useState([]);
  const [sbSelectedDb, setSbSelectedDb] = useState('');
  const [sbSchemaList, setSbSchemaList] = useState([]);
  const [sbSelectedSchema, setSbSelectedSchema] = useState('');
  const [sbTableList, setSbTableList] = useState([]);
  const [sbSelectedTables, setSbSelectedTables] = useState([]);
  const [sbLoadingSchemas, setSbLoadingSchemas] = useState(false);
  const [sbUrlInput, setSbUrlInput] = useState('');
  const [sbS3Creds, setSbS3Creds] = useState({ bucket: '', key: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });

  // Dialog States
  const [duplicateModal, setDuplicateModal] = useState({ open: false, type: '', payload: null, existingName: '' });
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [selectedFilesToDownload, setSelectedFilesToDownload] = useState([]);
  const [downloadFormat, setDownloadFormat] = useState('csv');
  const [includeOriginalInDownload, setIncludeOriginalInDownload] = useState(false);
  
  // Advanced Extraction Target States (Local, Snowflake, AWS)
  const [extractionTarget, setExtractionTarget] = useState('local');
  const [awsModalNoticeOpen, setAwsModalNoticeOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('saved_workspaces', JSON.stringify(savedWorkspace));
    } catch (e) {
      console.error("Failed to save workspace to localStorage", e);
    }
  }, [savedWorkspace]);

  const generateVersionedName = (baseName) => {
    let counter = 1;
    let newName = `${baseName}_${counter}`;
    while (savedWorkspace[newName]) {
      counter++;
      newName = `${baseName}_${counter}`;
    }
    return newName;
  };

  const handleDatasetLoaded = async (datasetName, cols, dbSource = null, schemaSource = null, tableSource = null) => {
    setActiveDataset(datasetName);
    setColumns(cols);

    const initRules = {};
    cols.forEach(c => {
      initRules[c] = { algo: "None", case: "Original Case", consistent: true, preserve_format: true, target_date_format: "%d-%m-%Y" };
    });
    setRules(initRules);

    setSavedWorkspace(prev => ({ 
      ...prev, 
      [datasetName]: { 
        columns: cols, 
        originalDb: dbSource || selectedDb || sbSelectedDb || "MY_DB",
        originalSchema: schemaSource || selectedSchema || sbSelectedSchema || "PUBLIC",
        originalTable: tableSource || datasetName
      } 
    }));

    const previewRes = await fetchDatasetPreview(datasetName, 1, rowsPerPage);
    setData(previewRes.data);
    setTotalRows(previewRes.total_rows);
    setIsAnonymizedView(false);
    setIsExecuted(false);
  };

  const processFileUpload = async (file, overrideName = null) => {
    const rawName = overrideName || file.name.split('.')[0].replace(/ /g, '_');
    if (!overrideName && savedWorkspace[rawName]) {
      setDuplicateModal({ open: true, type: 'FILE', payload: file, existingName: rawName });
      return;
    }

    try {
      const res = await uploadDataset(file, overrideName);
      await handleDatasetLoaded(res.dataset_name, res.columns);
    } catch (err) {
      alert("Error uploading file: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setLoading(true);
    for (const file of files) {
      await processFileUpload(file);
    }
    setLoading(false);
  };

  const processS3Fetch = async (config = s3Creds, overrideName = null) => {
    if (!config.bucket || !config.key) return;
    setLoading(true);
    try {
      const baseName = config.key.split('/').pop().split('.')[0];
      const targetName = overrideName || baseName;
      if (!overrideName && savedWorkspace[targetName]) {
        setLoading(false);
        setDuplicateModal({ open: true, type: 'S3', payload: config, existingName: targetName });
        return;
      }
      const res = await fetchFromS3({ ...config, customDatasetName: overrideName });
      
      setS3ExportCreds({
        bucket: config.bucket,
        destinationKey: config.key.substring(0, config.key.lastIndexOf('/') + 1) || '',
        region: config.region || 'us-east-1',
        accessKeyId: config.accessKeyId || '',
        secretAccessKey: config.secretAccessKey || ''
      });
      setAwsLoggedIn(true);

      await handleDatasetLoaded(res.dataset_name, res.columns);
    } catch (err) {
      alert("S3 Ingest Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAwsBuckets = async (customCreds = null) => {
    const keyId = customCreds ? customCreds.accessKeyId : s3ExportCreds.accessKeyId;
    const secretKey = customCreds ? customCreds.secretAccessKey : s3ExportCreds.secretAccessKey;
    const regionName = customCreds ? customCreds.region : s3ExportCreds.region;

    if (!keyId || !secretKey) {
      alert("Please enter your AWS Access Key ID and Secret Access Key.");
      return;
    }
    setLoadingAwsBuckets(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/ingest/s3/buckets`, {
        region_name: regionName || 'us-east-1',
        aws_access_key_id: keyId,
        aws_secret_access_key: secretKey
      });
      setAwsBuckets(res.data.buckets || []);
      setAwsLoggedIn(true);
      if (customCreds) {
        setS3ExportCreds(customCreds);
      }
    } catch (err) {
      alert("Failed to connect to AWS S3: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingAwsBuckets(false);
    }
  };

  const handleSelectAwsBucket = async (bucketName) => {
    setSelectedAwsBucket(bucketName);
    setSelectedAwsFolder('');
    setCustomFolderInput('');
    setAwsFolders([]);
    if (!bucketName) return;

    try {
      const res = await axios.post(`http://localhost:8000/api/ingest/s3/folders`, {
        bucket: bucketName,
        region_name: s3ExportCreds.region || 'us-east-1',
        aws_access_key_id: s3ExportCreds.accessKeyId,
        aws_secret_access_key: s3ExportCreds.secretAccessKey
      });
      setAwsFolders(res.data.folders || []);
    } catch (err) {
      setAwsFolders([]);
    }
  };

  const handleConnectDb = async (isSidebar = false) => {
    setLoading(true);
    try {
      const platform = isSidebar ? sbDbPlatform : dbPlatform;
      const creds = isSidebar ? (platform === 'MySQL' ? sbMysqlCreds : sbSnowflakeCreds) : (platform === 'MySQL' ? mysqlCreds : snowflakeCreds);

      if (isSidebar) {
        setSbDbConnected(false);
        setSbDbList([]);
        setSbSelectedDb('');
        setSbSchemaList([]);
        setSbSelectedSchema('');
        setSbTableList([]);
        setSbSelectedTables([]);
      } else {
        setDbConnected(false);
        setDbList([]);
        setSelectedDb('');
        setSchemaList([]);
        setSelectedSchema('');
        setTableList([]);
        setSelectedTables([]);
      }

      if (platform === 'MySQL') {
        const res = await connectMySQLDatabases(creds);
        if (isSidebar) {
          setSbDbList(res.databases);
          setSbDbConnected(true);
        } else {
          setDbList(res.databases);
          setDbConnected(true);
        }
      } else if (platform === 'Snowflake') {
        const res = await connectSnowflakeDatabases(creds);
        if (isSidebar) {
          setSbDbList(res.databases);
          setSbDbConnected(true);
        } else {
          setDbList(res.databases);
          setDbConnected(true);
        }
      } else {
        alert(`${platform} connector is currently not configured.`);
      }
    } catch (err) {
      alert("Connection Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDb = async (dbName, isSidebar = false) => {
    if (isSidebar) {
      setSbSelectedDb(dbName);
      setSbSelectedSchema('');
      setSbSchemaList([]);
      setSbTableList([]);
      setSbSelectedTables([]);
    } else {
      setSelectedDb(dbName);
      setSelectedSchema('');
      setSchemaList([]);
      setTableList([]);
      setSelectedTables([]);
    }

    if (!dbName) return;

    const platform = isSidebar ? sbDbPlatform : dbPlatform;
    const creds = isSidebar ? (platform === 'MySQL' ? sbMysqlCreds : sbSnowflakeCreds) : (platform === 'MySQL' ? mysqlCreds : snowflakeCreds);

    if (platform === 'MySQL') {
      setLoading(true);
      try {
        const res = await fetchMySQLTables({ ...creds, database: dbName });
        if (isSidebar) setSbTableList(res.tables || []);
        else setTableList(res.tables || []);
      } catch (err) {
        alert("Error fetching MySQL tables: " + (err.response?.data?.detail || err.message));
      } finally {
        setLoading(false);
      }
    } else if (platform === 'Snowflake') {
      if (isSidebar) setSbLoadingSchemas(true); else setLoadingSchemas(true);
      try {
        const res = await fetchSnowflakeSchemas({ ...creds, database: dbName });
        if (isSidebar) {
          setSbSchemaList(res.schemas || []);
        } else {
          setSchemaList(res.schemas || []);
        }
      } catch (err) {
        alert("Error fetching Snowflake schemas: " + (err.response?.data?.detail || err.message));
      } finally {
        if (isSidebar) setSbLoadingSchemas(false); else setLoadingSchemas(false);
      }
    }
  };

  const handleSelectSchema = async (schemaName, isSidebar = false) => {
    if (isSidebar) {
      setSbSelectedSchema(schemaName);
      setSbTableList([]);
      setSbSelectedTables([]);
    } else {
      setSelectedSchema(schemaName);
      setTableList([]);
      setSelectedTables([]);
    }

    if (!schemaName) return;

    setLoading(true);
    try {
      const platform = isSidebar ? sbDbPlatform : dbPlatform;
      const creds = isSidebar ? (platform === 'MySQL' ? sbMysqlCreds : sbSnowflakeCreds) : (platform === 'MySQL' ? mysqlCreds : snowflakeCreds);
      const db = isSidebar ? sbSelectedDb : selectedDb;

      if (platform === 'Snowflake') {
        const res = await fetchSnowflakeTables({ ...creds, database: db, schema: schemaName });
        if (isSidebar) setSbTableList(res.tables || []); else setTableList(res.tables || []);
      }
    } catch (err) {
      alert("Error fetching tables: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const processDbImport = async (isSidebar = false) => {
    const tables = isSidebar ? sbSelectedTables : selectedTables;
    const db = isSidebar ? sbSelectedDb : selectedDb;
    const schema = isSidebar ? sbSelectedSchema : selectedSchema;
    const platform = isSidebar ? sbDbPlatform : dbPlatform;
    const creds = isSidebar ? (platform === 'MySQL' ? sbMysqlCreds : sbSnowflakeCreds) : (platform === 'MySQL' ? mysqlCreds : snowflakeCreds);

    if (tables.length === 0) return;

    setLoading(true);
    try {
      let lastLoadedName = '';
      let lastCols = [];
      for (const tbl of tables) {
        const baseName = platform === 'Snowflake' ? `${db}_${schema}_${tbl}`.replace(/ /g, '_') : `${db}_${tbl}`.replace(/ /g, '_');
        const targetName = savedWorkspace[baseName] ? generateVersionedName(baseName) : baseName;

        let res;
        if (platform === 'MySQL') {
          res = await importMySQLTable({ ...creds, database: db, table: tbl }, targetName);
        } else {
          res = await importSnowflakeTable({ ...creds, database: db, schema, table: tbl }, targetName);
        }

        lastLoadedName = res.dataset_name;
        lastCols = res.columns;
        setSavedWorkspace(prev => ({ ...prev, [res.dataset_name]: { columns: res.columns } }));
      }
      if (lastLoadedName) {
        await handleDatasetLoaded(lastLoadedName, lastCols);
      }
    } catch (err) {
      alert("Error importing tables: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const processUrlFetch = async (targetUrl = urlInput, overrideName = null) => {
    if (!targetUrl) return;
    setLoading(true);
    try {
      const res = await fetchFromUrl(targetUrl, overrideName);
      if (!overrideName && savedWorkspace[res.dataset_name]) {
        setLoading(false);
        setDuplicateModal({ open: true, type: 'URL', payload: null, existingName: res.dataset_name });
        return;
      }
      await handleDatasetLoaded(res.dataset_name, res.columns);
    } catch (err) {
      alert("URL Fetch Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAtAnyCost = async () => {
    const versionedName = generateVersionedName(duplicateModal.existingName);
    const modalType = duplicateModal.type;
    const payload = duplicateModal.payload;
    setDuplicateModal({ open: false, type: '', payload: null, existingName: '' });

    if (modalType === 'FILE') await processFileUpload(payload, versionedName);
    else if (modalType === 'URL') await processUrlFetch(urlInput, versionedName);
    else if (modalType === 'S3') await processS3Fetch(payload, versionedName);
  };

  const handleSaveRule = (col, newRule) => {
    const updated = { ...rules, [col]: newRule };
    setRules(updated);
  };

  const hasConfiguredRules = Object.values(rules).some(r => r && r.algo && r.algo !== 'None');

  const applyAnonymization = async (activeRules = rules, targetPage = page, limit = rowsPerPage) => {
    setLoading(true);
    try {
      const res = await fetchAnonymizedPreview(activeDataset, activeRules, targetPage, limit);
      setData(res.data);
      setTotalRows(res.total_rows || totalRows);
      setIsAnonymizedView(true);
      setIsExecuted(true);
    } catch (err) {
      alert("Error running anonymization: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfig = async () => {
    const initRules = {};
    columns.forEach(c => { initRules[c] = { algo: "None", target_date_format: "%d-%m-%Y" }; });
    setRules(initRules);
    setIsAnonymizedView(false);
    setIsExecuted(false);

    if (activeDataset) {
      setLoading(true);
      const previewRes = await fetchDatasetPreview(activeDataset, 1, rowsPerPage);
      setData(previewRes.data);
      setTotalRows(previewRes.total_rows);
      setLoading(false);
    }
  };

  const handleToggleView = async (isChecked) => {
    if (isChecked && isExecuted) {
      await applyAnonymization(rules, page, rowsPerPage);
    } else {
      setLoading(true);
      const previewRes = await fetchDatasetPreview(activeDataset, page, rowsPerPage);
      setData(previewRes.data);
      setTotalRows(previewRes.total_rows);
      setIsAnonymizedView(false);
      setLoading(false);
    }
  };

  const handlePageChange = async (newPage, newLimit = rowsPerPage) => {
    setPage(newPage);
    setRowsPerPage(newLimit);
    if (isAnonymizedView) {
      await applyAnonymization(rules, newPage, newLimit);
    } else {
      setLoading(true);
      const previewRes = await fetchDatasetPreview(activeDataset, newPage, newLimit);
      setData(previewRes.data);
      setTotalRows(previewRes.total_rows);
      setLoading(false);
    }
  };

  const handleDeleteDataset = (dsName) => {
    const updated = { ...savedWorkspace };
    delete updated[dsName];
    setSavedWorkspace(updated);
    if (activeDataset === dsName) {
      setActiveDataset('');
      setColumns([]);
      setData([]);
      setIsExecuted(false);
    }
  };

  const handleOpenDownloadModal = () => {
    setSelectedFilesToDownload(activeDataset ? [activeDataset] : Object.keys(savedWorkspace));
    setDownloadModalOpen(true);
  };

  const handleConfirmMultiDownload = async () => {
    setDownloadModalOpen(false);

    if (extractionTarget === 'aws') {
      setLoading(true);
      try {
        for (const ds of selectedFilesToDownload) {
          const folderToUse = selectedAwsFolder === 'new_custom' ? customFolderInput : selectedAwsFolder;
          const folderClean = folderToUse && folderToUse !== '(Root)' ? `${folderToUse.replace(/\/$/, '')}/` : '';
          const targetKey = `${folderClean}anonymized_${ds}.${downloadFormat}`;
          await exportToS3({
            datasetName: ds,
            bucket: selectedAwsBucket,
            destinationKey: targetKey,
            format: downloadFormat,
            region: s3ExportCreds.region,
            accessKeyId: s3ExportCreds.accessKeyId,
            secretAccessKey: s3ExportCreds.secretAccessKey,
            rules: rules || {}
          });
        }
        alert("Successfully exported anonymized data to AWS S3!");
      } catch (err) {
        alert("AWS S3 Export Error: " + (err.response?.data?.detail || err.message));
      } finally {
        setLoading(false);
      }
    } else if (extractionTarget === 'snowflake') {
      setLoading(true);
      try {
        for (const dsName of selectedFilesToDownload) {
          const previewRes = await fetchAnonymizedPreview(dsName, rules, 1, 1000000);
          const workspaceMeta = savedWorkspace[dsName] || {};
          const originalDb = workspaceMeta.originalDb || selectedDb || sbSelectedDb || "MY_DB";
          const schemaName = workspaceMeta.originalSchema || selectedSchema || sbSelectedSchema || "PUBLIC";
          const tableName = workspaceMeta.originalTable || dsName;

          await importSnowflakeTable({
            ...snowflakeCreds,
            database: originalDb,
            schema: schemaName,
            table: tableName,
            action: 'extract_test_db',
            dataframe_dicts: previewRes.data
          }, dsName);
        }
        alert("Successfully extracted and re-uploaded anonymized datasets to Snowflake TEST_DATA_DB!");
      } catch (err) {
        alert("Snowflake Extraction Error: " + (err.response?.data?.detail || err.message));
      } finally {
        setLoading(false);
      }
    } else {
      const rulesMap = {};
      selectedFilesToDownload.forEach(ds => { rulesMap[ds] = rules; });
      await downloadMultiDatasetPackage(selectedFilesToDownload, rulesMap, downloadFormat, includeOriginalInDownload);
    }
  };

  // COMPLETE CLEAN RESET ON HOME CLICK (WIPES ALL CREDENTIALS & WORKSPACE)
  const handleHomeClick = () => {
    setHomeModalOpen(true);
  };

  const handleHomeAgree = () => {
    setHomeModalOpen(false);
    setActiveDataset('');
    setColumns([]);
    setData([]);
    setRules({});
    setIsExecuted(false);
    setIsAnonymizedView(false);
    setSavedWorkspace({});
    localStorage.removeItem('saved_workspaces');
    
    // Wipe all login and connection credentials completely
    setMysqlCreds({ host: 'localhost', port: 3306, user: 'root', password: '' });
    setSnowflakeCreds({ account: '', user: '', password: '', warehouse: 'COMPUTE_WH', role: '' });
    setDbConnected(false);
    setDbList([]);
    setSelectedDb('');
    setSchemaList([]);
    setSelectedSchema('');
    setTableList([]);
    setSelectedTables([]);
    setUrlInput('');
    setS3Creds({ bucket: '', key: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });
    setAwsLoggedIn(false);
    setAwsBuckets([]);
    setAwsFolders([]);
    setSelectedAwsBucket('');
    setSelectedAwsFolder('');
    setCustomFolderInput('');
    setS3ExportCreds({ bucket: '', destinationKey: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });
  };

  const handleHomeDisagree = () => {
    setHomeModalOpen(false);
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden font-sans m-0 p-0 ${isFullScreenTable ? 'fixed inset-0 z-50' : ''}`}
      style={{ backgroundColor: '#E3EBFA', position: 'fixed', top: 0, left: 0 }}
    >

      {/* 🛡️ TITLE BANNER */}
      <header
        className="flex items-center justify-between px-6 py-1.5 border-b flex-shrink-0"
        style={{
          background: '#FFFFFF',
          borderColor: '#E2E8F0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          zIndex: 10
        }}
      >
        <div className="flex items-center space-x-2.5">
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "linear-gradient(135deg,#8B5CF6,#2563EB)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: "14px"
            }}
          >
            D
          </div>
          <Typography
            style={{
              fontSize: '17px',
              fontWeight: 900,
              color: '#1E293B',
              letterSpacing: '-0.5px'
            }}
          >
            DataEase
          </Typography>
        </div>

        {activeDataset && (
          <div className="flex items-center space-x-2.5">
            <label className="switch" title="Toggle Anonymization View">
              <input
                type="checkbox"
                checked={isAnonymizedView}
                onChange={(e) => handleToggleView(e.target.checked)}
              />
              <span className="slider"></span>
            </label>

            {hasConfiguredRules && (
              <Button
                variant="contained"
                onClick={() =>
                  applyAnonymization(
                    rules,
                    page,
                    rowsPerPage
                  )
                }
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "11px",
                  px: 2,
                  py: 0.4,
                  background: "linear-gradient(135deg,#8B5CF6,#6366F1)",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.2)",
                  "&:hover": {
                    background: "linear-gradient(135deg,#7C3AED,#4F46E5)"
                  }
                }}
              >
                Run Anonymization
              </Button>
            )}

            <IconButton
              size="small"
              onClick={() => setIsFullScreenTable(!isFullScreenTable)}
              title="Expand Table to Complete Screen"
              sx={{
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                color: "#334155",
                padding: '4px',
                "&:hover": {
                  background: "#E2E8F0"
                }
              }}
            >
              {isFullScreenTable ? (
                <FullscreenExitIcon sx={{ fontSize: 16 }} />
              ) : (
                <FullscreenIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </div>
        )}
      </header>

      {/* MAIN APP BODY SPLIT CONTAINER */}
      <div className="flex flex-1 overflow-hidden">

        {/* 👈 LEFT SIDEBAR */}
        {!isFullScreenTable && isSidebarOpen && (
          <aside
            className="w-56 flex flex-col justify-between p-2 shadow-xl border-r flex-shrink-0 h-full overflow-hidden"
            style={{ backgroundColor: '#D5E7ED', borderColor: '#94A3B8', color: '#0F172A' }}
          >
            <div className="flex items-center justify-between pb-1.5 flex-shrink-0 border-b" style={{ borderColor: '#CBD5E1' }}>
              <button
                className="home-custom-btn"
                onClick={handleHomeClick}
              >
                🏠 Home
              </button>
              <IconButton
                size="small"
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse Sidebar"
                className="p-1"
                style={{ color: '#1E293B' }}
              >
                <MenuOpenIcon style={{ fontSize: 18 }} />
              </IconButton>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pt-2">
              {activeDataset && (
                <div className="flex flex-col pb-2 border-b" style={{ borderColor: '#94A3B8' }}>
                  <Typography variant="caption" className="font-extrabold uppercase text-[10px] block mb-1 border-b pb-0.5 sticky top-0 bg-[#D5E7ED] z-10" style={{ color: '#4F46E5', borderColor: '#CBD5E1' }}>
                    📊 Rule Registry ({Object.values(rules).filter(r => r && r.algo && r.algo !== 'None').length})
                  </Typography>
                  <div className="space-y-1 pr-1 overflow-y-auto max-h-[140px]">
                    {columns.map(col => {
                      const r = rules[col];
                      if (!r || !r.algo || r.algo === 'None') return null;
                      return (
                        <div key={col} className="p-1 rounded text-[10px] flex justify-between items-center border" style={{ backgroundColor: '#ECFDF5', borderColor: '#CBD5E1', borderLeft: '3px solid #4F46E5' }}>
                          <span className="font-bold truncate max-w-[100px]" style={{ color: '#1E293B' }}>{col}</span>
                          <span className="font-bold px-1 py-0.2 rounded text-[8px]" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}>
                            {r.algo}
                          </span>
                        </div>
                      );
                    })}
                    {Object.values(rules).filter(r => r && r.algo && r.algo !== 'None').length === 0 && (
                      <Typography variant="caption" className="italic block pl-1 text-[10px]" style={{ color: '#64748B' }}>
                        No rules configured.
                      </Typography>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col pt-1">
                <div
                  className="flex items-center justify-between cursor-pointer border-b pb-0.5 mb-1 sticky top-0 bg-[#D5E7ED] z-10"
                  style={{ borderColor: '#CBD5E1' }}
                  onClick={() => setIsWorkspacesOpen(!isWorkspacesOpen)}
                >
                  <Typography variant="caption" className="font-extrabold uppercase text-[10px]" style={{ color: '#4F46E5' }}>
                    📁 {isWorkspacesOpen ? 'Hide Workspaces' : 'Saved Workspaces'}
                  </Typography>
                  <span className="text-[10px] font-bold" style={{ color: '#4F46E5' }}>{isWorkspacesOpen ? '▲' : '▼'}</span>
                </div>

                {isWorkspacesOpen && (
                  Object.keys(savedWorkspace).length === 0 ? (
                    <Typography variant="caption" className="italic block pl-1 text-[10px]" style={{ color: '#64748B' }}>
                      No saved workspaces.
                    </Typography>
                  ) : (
                    <div className="space-y-1 pr-1 overflow-y-auto max-h-[140px]">
                      {Object.keys(savedWorkspace).map(dsName => (
                        <div
                          key={dsName}
                          className={`flex items-center justify-between p-1 rounded text-[11px] transition-colors cursor-pointer border ${
                            activeDataset === dsName ? 'font-bold' : ''
                          }`}
                          style={{
                            backgroundColor: activeDataset === dsName ? '#334155' : '#FFFFFF',
                            color: activeDataset === dsName ? '#FFFFFF' : '#1E293B',
                            borderColor: '#CBD5E1'
                          }}
                        >
                          <span
                            className="truncate flex-1"
                            onClick={async () => {
                              setActiveDataset(dsName);
                              setColumns(savedWorkspace[dsName].columns);
                              const previewRes = await fetchDatasetPreview(dsName, 1, rowsPerPage);
                              setData(previewRes.data);
                              setTotalRows(previewRes.total_rows);
                              setIsExecuted(false);
                            }}
                          >
                            {activeDataset === dsName ? '⚡ ' : ''}{dsName}
                          </span>
                          <IconButton size="small" onClick={() => handleDeleteDataset(dsName)} className="p-0.5" style={{ color: '#B91C1C' }}>
                            <DeleteIcon style={{ fontSize: 11 }} />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Data Ingestion Hub in left sidebar */}
              {activeDataset && (
                <div className="pt-2 border-t" style={{ borderColor: '#CBD5E1' }}>
                  <Typography variant="caption" className="font-extrabold uppercase text-[10px] block mb-1 border-b pb-0.5" style={{ color: '#4F46E5', borderColor: '#CBD5E1' }}>
                    🌐 Data Ingestion Hub
                  </Typography>

                  <div className="space-y-1.5 p-1.5 rounded border bg-white border-slate-300">
                    <Button
                      variant="outlined"
                      size="small"
                      component="label"
                      startIcon={<CloudUploadIcon style={{ fontSize: 11 }} />}
                      fullWidth
                      className="text-[9px] font-bold py-0.5"
                      style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5' }}
                    >
                      Upload Files
                      <input type="file" multiple hidden onChange={handleFileUpload} />
                    </Button>

                    <div className="border-t pt-1" style={{ borderColor: '#E2E8F0' }}>
                      <div
                        onClick={() => setIsSidebarDbOpen(!isSidebarDbOpen)}
                        className="flex justify-between items-center cursor-pointer py-1 px-1 bg-slate-100 rounded text-[9.5px] font-bold text-slate-700"
                      >
                        <span>🔌 DB or Server Connection</span>
                        <span>{isSidebarDbOpen ? '▲' : '▼'}</span>
                      </div>

                      {isSidebarDbOpen && (
                        <div className="space-y-1 mt-1 p-1 border rounded bg-slate-50 border-slate-200">
                          <select
                            value={sbDbPlatform}
                            onChange={e => { setSbDbPlatform(e.target.value); setSbDbConnected(false); setSbDbList([]); setSbSchemaList([]); }}
                            style={{ width: '100%', fontSize: '10px', padding: '2px', borderRadius: '3px', border: '1px solid #CBD5E1' }}
                          >
                            <option value="">Select DB</option>
                            <option value="MySQL">MySQL</option>
                            <option value="Snowflake">Snowflake</option>
                          </select>

                          {sbDbPlatform && !sbDbConnected ? (
                            <div className="space-y-1">
                              {sbDbPlatform === 'MySQL' ? (
                                <>
                                  <input type="text" placeholder="Host" value={sbMysqlCreds.host} onChange={e => setSbMysqlCreds({ ...sbMysqlCreds, host: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                  <input type="text" placeholder="User" value={sbMysqlCreds.user} onChange={e => setSbMysqlCreds({ ...sbMysqlCreds, user: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                  <input type="password" placeholder="Pass" value={sbMysqlCreds.password} onChange={e => setSbMysqlCreds({ ...sbMysqlCreds, password: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                </>
                              ) : (
                                <>
                                  <input type="text" placeholder="Account ID" value={sbSnowflakeCreds.account} onChange={e => setSbSnowflakeCreds({ ...sbSnowflakeCreds, account: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                  <input type="text" placeholder="User" value={sbSnowflakeCreds.user} onChange={e => setSbSnowflakeCreds({ ...sbSnowflakeCreds, user: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                  <input type="password" placeholder="Pass" value={sbSnowflakeCreds.password} onChange={e => setSbSnowflakeCreds({ ...sbSnowflakeCreds, password: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '2px' }} />
                                </>
                              )}
                              <button onClick={() => handleConnectDb(true)} style={{ width: '100%', fontSize: '9.5px', background: '#4F46E5', color: '#FFF', border: 'none', borderRadius: '3px', padding: '3px', fontWeight: 'bold', cursor: 'pointer' }}>
                                Connect
                              </button>
                            </div>
                          ) : sbDbConnected ? (
                            <div className="space-y-1">
                              <select value={sbSelectedDb} onChange={e => handleSelectDb(e.target.value, true)} style={{ width: '100%', fontSize: '10px', padding: '2px', border: '1px solid #CBD5E1', borderRadius: '3px' }}>
                                <option value="">Select DB</option>
                                {sbDbList.map(db => <option key={db} value={db}>{db}</option>)}
                              </select>

                              {sbDbPlatform === 'Snowflake' && sbSelectedDb && (
                                <select value={sbSelectedSchema} onChange={e => handleSelectSchema(e.target.value, true)} disabled={sbLoadingSchemas} style={{ width: '100%', fontSize: '10px', padding: '2px', border: '1px solid #CBD5E1', borderRadius: '3px' }}>
                                  <option value="">{sbLoadingSchemas ? "Loading..." : "Select Schema"}</option>
                                  {sbSchemaList.map(sch => <option key={sch} value={sch}>{sch}</option>)}
                                </select>
                              )}

                              {sbTableList.length > 0 && (
                                <button onClick={() => processDbImport(true)} style={{ width: '100%', fontSize: '9.5px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '3px', padding: '3px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  Import Table
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-1" style={{ borderColor: '#E2E8F0' }}>
                      <div
                        onClick={() => setIsSidebarUrlOpen(!isSidebarUrlOpen)}
                        className="flex justify-between items-center cursor-pointer py-1 px-1 bg-slate-100 rounded text-[9.5px] font-bold text-slate-700"
                      >
                        <span>🔗 Fetch URL</span>
                        <span>{isSidebarUrlOpen ? '▲' : '▼'}</span>
                      </div>

                      {isSidebarUrlOpen && (
                        <div className="space-y-1 mt-1 p-1 border rounded bg-slate-50 border-slate-200">
                          <input type="text" placeholder="Paste link..." value={sbUrlInput} onChange={e => setSbUrlInput(e.target.value)} style={{ width: '100%', fontSize: '10px', padding: '2px', border: '1px solid #CBD5E1', borderRadius: '3px' }} />
                          <button onClick={() => processUrlFetch(sbUrlInput)} disabled={!sbUrlInput} style={{ width: '100%', fontSize: '9.5px', background: '#06B6D4', color: '#FFF', border: 'none', borderRadius: '3px', padding: '3px', fontWeight: 'bold', cursor: 'pointer' }}>
                            Fetch Link
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

            </div>

            <div className="space-y-1 pb-1 pt-1 border-t mt-0 flex-shrink-0" style={{ borderColor: '#CBD5E1' }}>
              {hasConfiguredRules && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<RestartAltIcon style={{ fontSize: 12 }} />}
                  onClick={handleResetConfig}
                  className="font-bold py-0.5 text-[10px]"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', boxShadow: 'none' }}
                >
                  Reset Config
                </Button>
              )}

              {isExecuted && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadIcon style={{ fontSize: 12 }} />}
                  onClick={handleOpenDownloadModal}
                  disabled={Object.keys(savedWorkspace).length === 0}
                  className="font-bold py-0.5 text-[10px]"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #06B6D4)', border: '1px solid #CBD5E1', color: '#FFFFFF', boxShadow: 'none' }}
                >
                  Download / Extract
                </Button>
              )}
            </div>
          </aside>
        )}

        {/* 🚀 RIGHT MAIN CONTENT PANEL */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden p-3 ${isFullScreenTable ? 'bg-white absolute inset-0 z-50' : ''}`} style={{
          background: 'linear-gradient(180deg,#F8FAFC,#EEF2FF)'
        }}>

          {!isFullScreenTable && !isSidebarOpen && (
            <div className="flex items-center pb-2 flex-shrink-0">
              <IconButton
                size="small"
                onClick={() => setIsSidebarOpen(true)}
                title="Open Sidebar"
                className="p-1 rounded bg-white shadow border border-slate-300"
                style={{ color: '#1E293B' }}
              >
                <MenuIcon style={{ fontSize: 18 }} />
              </IconButton>
            </div>
          )}

          {isFullScreenTable && (
            <div className="flex justify-between items-center p-2 rounded-none flex-shrink-0 border-b" style={{ backgroundColor: '#7D92A3', borderColor: '#CBD5E1', color: '#1E293B' }}>
              <Typography variant="caption" className="font-bold text-xs" style={{ color: '#1E293B' }}>
                📊 Full Screen View: {activeDataset}
              </Typography>
              <IconButton size="small" onClick={() => setIsFullScreenTable(false)} className="p-0.5 rounded" style={{ backgroundColor: '#334155', color: '#FFFFFF' }}>
                <FullscreenExitIcon fontSize="small" />
              </IconButton>
            </div>
          )}

          {!activeDataset ? (
            <div
              className="mx-auto w-full space-y-1.5 overflow-y-auto flex flex-col justify-start"
              style={{
                maxWidth: '1200px',
                padding: '1.5px 12px 8px 12px',
                minHeight: '100%'
              }}
            >
              <Typography
                variant="subtitle2"
                className="tracking-wider text-center"
                style={{ color: '#1E293B', marginTop: '1.5px', marginBottom: '8px', fontSize: '14px', fontWeight: 900 }}
              >
                ⚡ Quick Data Ingestion Hub
              </Typography>

              {/* 4-COLUMN RESPONSIVE GRID LAYOUT */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '12px',
                alignItems: 'start',
                justifyContent: 'center'
              }}>

                {/* 1. Local Files Card */}
                <div style={{ padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', maxWidth: '280px', width: '100%', margin: '0 auto' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                      <CloudUploadIcon sx={{ fontSize: 16 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                    Local Files
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '8px' }}>
                    Upload files from your local system
                  </div>

                  <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                    <div style={{ marginBottom: '2px' }}>
                      <CloudUploadIcon sx={{ fontSize: 28, color: "#8B5CF6" }} />
                    </div>

                    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: "#1E293B" }}>
                      Drag & Drop Files
                    </Typography>

                    <Typography sx={{ mt: 0.1, color: "#64748B", fontSize: '9.5px', textAlign: "center" }}>
                      Drop files here or browse device
                    </Typography>

                    <Button
                      component="label"
                      variant="contained"
                      sx={{
                        mt: 1,
                        borderRadius: "6px",
                        textTransform: "none",
                        fontSize: "10px",
                        py: 0.3,
                        px: 1.2,
                        background: "linear-gradient(135deg,#8B5CF6,#6D28D9)"
                      }}
                    >
                      Browse Files
                      <input hidden multiple type="file" onChange={handleFileUpload} />
                    </Button>
                  </div>
                </div>

                {/* 2. Database Card */}
                <div style={{ padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', maxWidth: '280px', width: '100%', margin: '0 auto' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7' }}>
                      <StorageIcon sx={{ fontSize: 16 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                    Database
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '8px' }}>
                    Connect to database & import tables
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '10px', color: '#0f172a', mb: 0.5 }}>
                      Select Provider:
                    </Typography>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'MySQL', icon: '🐬', val: 'MySQL' },
                        { label: 'Snowflake', icon: '❄️', val: 'Snowflake' }
                      ].map((item) => {
                        const isSelected = dbPlatform === item.val;
                        return (
                          <button
                            key={item.val}
                            onClick={() => {
                              setDbPlatform(item.val);
                              setDbConnected(false);
                              setDbList([]);
                              setSelectedDb('');
                              setSchemaList([]);
                              setSelectedSchema('');
                              setTableList([]);
                              setSelectedTables([]);
                            }}
                            style={{
                              fontSize: '9.5px',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #0284C7' : '1px solid #CBD5E1',
                              background: isSelected ? '#E0F2FE' : '#F8FAFC',
                              color: isSelected ? '#0369A1' : '#334155',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <span>{item.icon}</span> {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {dbPlatform && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: '10px',
                        color: '#065F46'
                      }}
                    >
                      {!dbConnected ? (
                        <>
                          {dbPlatform === "MySQL" ? (
                            <>
                              <input type="text" placeholder="Host" value={mysqlCreds.host} onChange={(e) => setMysqlCreds({ ...mysqlCreds, host: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                              <input type="text" placeholder="Username" value={mysqlCreds.user} onChange={(e) => setMysqlCreds({ ...mysqlCreds, user: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                              <input type="password" placeholder="Password" value={mysqlCreds.password} onChange={(e) => setMysqlCreds({ ...mysqlCreds, password: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                            </>
                          ) : (
                            <>
                              <input type="text" placeholder="Account ID" value={snowflakeCreds.account} onChange={(e) => setSnowflakeCreds({ ...snowflakeCreds, account: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                              <input type="text" placeholder="Username" value={snowflakeCreds.user} onChange={(e) => setSnowflakeCreds({ ...snowflakeCreds, user: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                              <input type="password" placeholder="Password" value={snowflakeCreds.password} onChange={(e) => setSnowflakeCreds({ ...snowflakeCreds, password: e.target.value })} style={{ fontSize: '10px', padding: '4px 6px', marginTop: '2px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                            </>
                          )}

                          <button
                            style={{ marginTop: '8px', fontSize: '10px', width: '100%', background: '#0284C7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', padding: '5px' }}
                            onClick={() => handleConnectDb()}
                          >
                            Connect Database
                          </button>
                        </>
                      ) : (
                        <>
                          <FormControl fullWidth size="small" sx={{ mt: 0.5, background: '#F8FAFC', borderRadius: '6px' }}>
                            <InputLabel sx={{ fontSize: '10px' }}>Database</InputLabel>
                            <Select value={selectedDb} label="Database" onChange={(e) => handleSelectDb(e.target.value)} sx={{ fontSize: '10px', height: '26px' }}>
                              {dbList.map((db) => <MenuItem key={db} value={db} sx={{ fontSize: '10px' }}>{db}</MenuItem>)}
                            </Select>
                          </FormControl>

                          {dbPlatform === 'Snowflake' && selectedDb && (
                            <FormControl fullWidth size="small" sx={{ mt: 0.8, background: '#F8FAFC', borderRadius: '6px' }}>
                              <InputLabel sx={{ fontSize: '10px' }}>Schema</InputLabel>
                              <Select value={selectedSchema} label="Schema" disabled={loadingSchemas} onChange={(e) => handleSelectSchema(e.target.value)} sx={{ fontSize: '10px', height: '26px' }}>
                                <MenuItem value=""><em>{loadingSchemas ? "Loading..." : "Select Schema"}</em></MenuItem>
                                {schemaList.map((sch) => <MenuItem key={sch} value={sch} sx={{ fontSize: '10px' }}>{sch}</MenuItem>)}
                              </Select>
                            </FormControl>
                          )}

                          {tableList.length > 0 && (
                            <div style={{ marginTop: "6px", maxHeight: "88px", overflowY: "auto", fontSize: "10px", border: '1px solid #A7F3D0', borderRadius: '6px', padding: '4px', background: '#FFFFFF' }}>
                              <span style={{ fontWeight: 600, fontSize: '9px', color: '#065F46', display: 'block', mb: '2px' }}>Select Tables:</span>
                              {tableList.map((table) => (
                                <FormControlLabel
                                  key={table}
                                  sx={{ display: 'block', m: 0, '& .MuiFormControlLabel-label': { fontSize: '10px' } }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      sx={{ p: 0.2 }}
                                      checked={selectedTables.includes(table)}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedTables([...selectedTables, table]);
                                        else setSelectedTables(selectedTables.filter((t) => t !== table));
                                      }}
                                    />
                                  }
                                  label={table}
                                />
                              ))}
                            </div>
                          )}

                          {tableList.length > 0 && (
                            <div style={{ marginTop: '6px' }}>
                              <button
                                style={{ fontSize: '10px', width: '100%', background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', padding: '5px' }}
                                onClick={() => processDbImport()}
                                disabled={selectedTables.length === 0}
                              >
                                Import Tables ({selectedTables.length})
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Direct URL Card */}
                <div style={{ padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', maxWidth: '280px', width: '100%', margin: '0 auto' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                      <LinkIcon sx={{ fontSize: 16 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                    Direct URL
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '8px' }}>
                    Fetch Data from any Public URL
                  </div>

                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '8px', color: '#065F46', marginTop: '8px', fontSize: '10px' }}>
                    🔒 Secure Encrypted Connection
                  </div>

                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/data.csv"
                    style={{ marginTop: '10px', fontSize: '10px', padding: '6px 8px', width: '100%', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }}
                  />

                  <button
                    style={{ marginTop: '12px', fontSize: '10.5px', width: '100%', background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', padding: '6px' }}
                    onClick={() => processUrlFetch()}
                    disabled={!urlInput || loading}
                  >
                    {loading ? "Fetching..." : "Fetch Data"}
                  </button>
                </div>

                {/* 4. Amazon S3 Card */}
                <div style={{ padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', maxWidth: '280px', width: '100%', margin: '0 auto' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                      <CloudIcon sx={{ fontSize: 16 }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                    Amazon S3
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '8px' }}>
                    Stream raw files from AWS S3 buckets
                  </div>

                  <div className="space-y-1 mt-1">
                    <input type="text" placeholder="Bucket Name" value={s3Creds.bucket} onChange={e => setS3Creds({ ...s3Creds, bucket: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                    <input type="text" placeholder="Object Key (path/file.csv)" value={s3Creds.key} onChange={e => setS3Creds({ ...s3Creds, key: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                    <input type="text" placeholder="Region (us-east-1)" value={s3Creds.region} onChange={e => setS3Creds({ ...s3Creds, region: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                    <input type="password" placeholder="Access Key ID (opt)" value={s3Creds.accessKeyId} onChange={e => setS3Creds({ ...s3Creds, accessKeyId: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }} />
                    <input type="password" placeholder="Secret Key (opt)" value={s3Creds.secretAccessKey} onChange={e => setS3Creds({ ...s3Creds, secretAccessKey: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }} />

                    <button
                      style={{ marginTop: '8px', fontSize: '10.5px', width: '100%', background: '#D97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', padding: '6px' }}
                      onClick={() => processS3Fetch()}
                      disabled={!s3Creds.bucket || !s3Creds.key || loading}
                    >
                      {loading ? "Streaming..." : "Fetch from S3"}
                    </button>
                  </div>
                </div>

              </div>

              {loading && <CircularProgress size={20} className="block mx-auto mt-2" />}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-1">
              {loading && <CircularProgress size={18} className="block mx-auto my-0.5" />}

              <div className="flex-1 min-h-0 overflow-hidden border rounded mt-1" style={{ backgroundColor: '#E3EBFA', borderColor: '#CBD5E1' }}>
                <DataPreviewTable
                  columns={columns}
                  data={data}
                  rules={rules}
                  totalRows={totalRows}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(newLimit) => {
                    setRowsPerPage(newLimit);
                  }}
                  onPageChange={handlePageChange}
                  onSaveRule={handleSaveRule}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Duplicate File Warning Dialog */}
      <Dialog
        open={duplicateModal.open}
        onClose={() => setDuplicateModal({ open: false, type: '', payload: null, existingName: '' })}
      >
        <DialogTitle className="flex items-center font-bold text-xs" style={{ color: '#B91C1C' }}>
          <WarningAmberIcon className="mr-1" fontSize="small" /> File Already Exists
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="text-[11px]" style={{ color: '#1E293B' }}>
            The dataset <strong>"{duplicateModal.existingName}"</strong> already exists in your saved workspace.
            <br /><br />
            Do you want to upload/fetch the file at any cost? It will be saved as <strong>"{generateVersionedName(duplicateModal.existingName)}"</strong>.
          </DialogContentText>
        </DialogContent>
        <DialogActions className="p-2 pt-0">
          <Button onClick={() => setDuplicateModal({ open: false, type: '', payload: null, existingName: '' })} color="inherit" className="text-[10px]" style={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button onClick={handleUploadAtAnyCost} variant="contained" className="font-bold text-[10px]" style={{ backgroundColor: '#B91C1C', color: '#FFFFFF', boxShadow: 'none' }}>
            Upload at Any Cost
          </Button>
        </DialogActions>
      </Dialog>

      {/* Home Confirmation Dialog */}
      <Dialog open={homeModalOpen} onClose={handleHomeDisagree} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center font-bold text-xs" style={{ color: '#4F46E5' }}>
          <WarningAmberIcon className="mr-1" fontSize="small" /> Leave Workspace?
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="text-[11px]" style={{ color: '#1E293B' }}>
            You are leaving the Workspace. All saved workspaces and cached credentials will be reset. Do you agree or Disagree?
          </DialogContentText>
        </DialogContent>
        <DialogActions className="p-2">
          <Button onClick={handleHomeDisagree} color="inherit" className="text-[10px]" style={{ color: '#64748B' }}>Disagree</Button>
          <Button onClick={handleHomeAgree} variant="contained" className="font-bold text-[10px]" style={{ backgroundColor: '#4F46E5', color: '#FFFFFF', boxShadow: 'none' }}>Agree</Button>
        </DialogActions>
      </Dialog>

      {/* Advanced Multi-Option Extraction / Download Dialog */}
      <Dialog
        open={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="font-bold text-xs flex items-center" style={{ color: '#1E293B' }}>
          <DownloadIcon className="mr-1 text-indigo-600" fontSize="small" /> Export & Extract Options
        </DialogTitle>
        <DialogContent className="space-y-2.5 pt-1">
          <DialogContentText className="text-[10px]" style={{ color: '#64748B' }}>
            Select files to export and choose your destination target:
          </DialogContentText>
          
          <FormGroup className="space-y-1 max-h-28 overflow-y-auto border p-1.5 rounded" style={{ backgroundColor: '#E3EBFA', borderColor: '#CBD5E1' }}>
            {Object.keys(savedWorkspace).map(fileName => {
              const isChecked = selectedFilesToDownload.includes(fileName);
              return (
                <FormControlLabel
                  key={fileName}
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFilesToDownload([...selectedFilesToDownload, fileName]);
                        } else {
                          setSelectedFilesToDownload(selectedFilesToDownload.filter(f => f !== fileName));
                        }
                      }}
                      size="small"
                      color="primary"
                    />
                  }
                  label={<span className="text-[11px] font-bold" style={{ color: '#1E293B' }}>📄 {fileName}</span>}
                />
              );
            })}
          </FormGroup>

          {/* 3 Extraction Destination Options */}
          <div className="space-y-1">
            <Typography className="text-[10px] font-bold text-slate-700">Select Extraction Destination:</Typography>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'local', label: '1. Local Folder', icon: '💻' },
                { id: 'snowflake', label: '2. Snowflake', icon: '❄️' },
                { id: 'aws', label: '3. AWS', icon: '☁️' }
              ].map(opt => {
                const isSelected = extractionTarget === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setExtractionTarget(opt.id);
                      if (opt.id === 'aws' && awsLoggedIn && s3ExportCreds.accessKeyId) {
                        handleFetchAwsBuckets({
                          accessKeyId: s3ExportCreds.accessKeyId,
                          secretAccessKey: s3ExportCreds.secretAccessKey,
                          region: s3ExportCreds.region
                        });
                      }
                    }}
                    style={{
                      fontSize: '9.5px',
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #4F46E5' : '1px solid #CBD5E1',
                      background: isSelected ? '#EEF2FF' : '#F8FAFC',
                      color: isSelected ? '#4F46E5' : '#334155',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div>{opt.icon}</div>
                    <div>{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {extractionTarget === 'local' && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel id="export-format-label" style={{ fontSize: 10, color: '#64748B' }}>Export Format</InputLabel>
                <Select
                  labelId="export-format-label"
                  value={downloadFormat}
                  label="Export Format"
                  style={{ fontSize: 10 }}
                  onChange={(e) => setDownloadFormat(e.target.value)}
                >
                  <MenuItem value="csv" style={{ fontSize: 10 }}>CSV (.csv)</MenuItem>
                  <MenuItem value="xlsx" style={{ fontSize: 10 }}>Excel (.xlsx)</MenuItem>
                  <MenuItem value="json" style={{ fontSize: 10 }}>JSON (.json)</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeOriginalInDownload}
                    onChange={(e) => setIncludeOriginalInDownload(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={<span className="text-[10px] font-semibold" style={{ color: '#1E293B' }}>Include original file(s) with anonymized package</span>}
              />
            </>
          )}

          {extractionTarget === 'snowflake' && (
            <div className="p-2 bg-slate-50 border rounded text-[10px] space-y-1 text-slate-700">
              <span className="font-bold text-indigo-600 block">Snowflake Target Info:</span>
              <span>Anonymized tables will be re-uploaded to database <strong>TEST_DATA_DB</strong> mirroring your table schemas.</span>
            </div>
          )}

          {extractionTarget === 'aws' && (
            <div className="space-y-2 p-2 border rounded bg-slate-50 border-slate-200 text-[10px]">
              {/* Option Mode selection if AWS session exists */}
              {s3ExportCreds.accessKeyId ? (
                <div className="space-y-2 pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-700 block">AWS Account Selection:</span>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="awsMode" 
                        checked={awsAccountMode === 'same'} 
                        onChange={() => {
                          setAwsAccountMode('same');
                          handleFetchAwsBuckets({
                            accessKeyId: s3ExportCreds.accessKeyId,
                            secretAccessKey: s3ExportCreds.secretAccessKey,
                            region: s3ExportCreds.region
                          });
                        }} 
                      />
                      <span>Same Account</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="awsMode" 
                        checked={awsAccountMode === 'different'} 
                        onChange={() => {
                          setAwsAccountMode('different');
                          setAwsLoggedIn(false);
                          setAwsBuckets([]);
                        }} 
                      />
                      <span>Different Account</span>
                    </label>
                  </div>
                </div>
              ) : null}

              {(!awsLoggedIn || awsAccountMode === 'different') ? (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-amber-700 block">🔒 Sign in to AWS S3 Account:</span>
                  <input type="text" placeholder="AWS Access Key ID" value={s3ExportCreds.accessKeyId} onChange={e => setS3ExportCreds({ ...s3ExportCreds, accessKeyId: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1' }} />
                  <input type="password" placeholder="AWS Secret Access Key" value={s3ExportCreds.secretAccessKey} onChange={e => setS3ExportCreds({ ...s3ExportCreds, secretAccessKey: e.target.value })} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1' }} />
                  <button onClick={() => handleFetchAwsBuckets()} disabled={loadingAwsBuckets} style={{ width: '100%', padding: '5px', background: '#D97706', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {loadingAwsBuckets ? "Connecting to AWS..." : "Login & Load Buckets"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-emerald-700 block">✅ Connected to AWS S3</span>
                  <div>
                    <label className="font-semibold block mb-0.5 text-slate-600">Select S3 Bucket:</label>
                    <select value={selectedAwsBucket} onChange={e => handleSelectAwsBucket(e.target.value)} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }}>
                      <option value="">-- Choose S3 Bucket --</option>
                      {awsBuckets.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  {selectedAwsBucket && (
                    <div className="space-y-1 pt-1">
                      <label className="font-semibold block mb-0.5 text-slate-600">Select Existing Folder or Create New:</label>
                      <select value={selectedAwsFolder} onChange={e => setSelectedAwsFolder(e.target.value)} style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }}>
                        <option value="(Root)">📁 (Root / No folder)</option>
                        <option value="new_custom">➕ Type New Folder Name...</option>
                        {awsFolders.map(f => <option key={f} value={f}>📁 {f}</option>)}
                      </select>

                      {selectedAwsFolder === 'new_custom' && (
                        <input 
                          type="text" 
                          placeholder="Enter new folder name (e.g., production_db)" 
                          value={customFolderInput} 
                          onChange={e => setCustomFolderInput(e.target.value)} 
                          style={{ width: '100%', fontSize: '10px', padding: '4px', borderRadius: '4px', border: '1px solid #CBD5E1', marginTop: '4px', background: '#FFF' }} 
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-2">
          <Button onClick={() => setDownloadModalOpen(false)} color="inherit" className="text-[10px]" style={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMultiDownload}
            variant="contained"
            disabled={selectedFilesToDownload.length === 0 || (extractionTarget === 'aws' && (!awsLoggedIn || !selectedAwsBucket)) || loading}
            className="font-bold text-[10px]"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #06B6D4)', color: '#FFFFFF', boxShadow: 'none' }}
          >
            {loading ? "Processing..." : extractionTarget === 'aws' ? 'Extract to AWS S3' : extractionTarget === 'snowflake' ? 'Extract to Snowflake' : `Download Selected (${selectedFilesToDownload.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}