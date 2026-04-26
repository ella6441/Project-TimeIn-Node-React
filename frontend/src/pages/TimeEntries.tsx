import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  TimePicker,
  Input,
  App,
  Popconfirm,
  Row,
  Col,
  Typography,
} from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { timeEntriesApi, type CreateTimeEntryDto } from '../api/timeEntries.api';
import { projectsApi } from '../api/projects.api';
import { tasksApi } from '../api/tasks.api';
import { useAuthStore } from '../store/auth.store';
import type { TimeEntry, Project, Task } from '../types';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

const workTypes = ['DEVELOPMENT', 'DESIGN', 'MEETINGS', 'REVIEW', 'TESTING', 'OTHER'];

function formatMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function TimeEntries() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [form] = Form.useForm();

  // Filters
  const [filterProject, setFilterProject] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterRange, setFilterRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    loadProjects();
    loadEntries();
  }, [page, filterProject, filterStatus, filterRange]);

  const loadProjects = async () => {
    try {
      const res = await projectsApi.findAll({ limit: 100 });
      setProjects(res.data.data);
    } catch {
      // ignore
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        projectId: filterProject,
        status: filterStatus,
        from: filterRange?.[0].format('YYYY-MM-DD'),
        to: filterRange?.[1].format('YYYY-MM-DD'),
      };
      const res = isManagerOrAdmin
        ? await timeEntriesApi.findAll(params)
        : await timeEntriesApi.findMine(params);
      setEntries(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('loadEntries error:', err);
      message.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const loadTasksForProject = async (projectId: string) => {
    try {
      const res = await tasksApi.findAll({ projectId, limit: 100 });
      setTasks(res.data.data);
    } catch {
      setTasks([]);
    }
  };

  const openCreate = () => {
    setEditEntry(null);
    form.resetFields();
    setTasks([]);
    setModalOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    loadTasksForProject(entry.projectId);
    form.setFieldsValue({
      projectId: entry.projectId,
      taskId: entry.taskId,
      date: dayjs(entry.date),
      startTime: dayjs(entry.startTime),
      endTime: dayjs(entry.endTime),
      workType: entry.workType,
      description: entry.description,
      relatedCommitHash: entry.relatedCommitHash,
      relatedClickUpTaskId: entry.relatedClickUpTaskId,
    });
    setModalOpen(true);
  };

  const handleSubmitModal = async () => {
    try {
      const values = await form.validateFields();
      const dto: CreateTimeEntryDto = {
        projectId: values.projectId,
        taskId: values.taskId,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.date.format('YYYY-MM-DD') + 'T' + values.startTime.format('HH:mm:ss'),
        endTime: values.date.format('YYYY-MM-DD') + 'T' + values.endTime.format('HH:mm:ss'),
        workType: values.workType,
        description: values.description,
        relatedCommitHash: values.relatedCommitHash,
        relatedClickUpTaskId: values.relatedClickUpTaskId,
      };
      if (editEntry) {
        await timeEntriesApi.update(editEntry.id, dto);
        message.success('Entry updated');
      } else {
        await timeEntriesApi.create(dto);
        message.success('Entry created');
      }
      setModalOpen(false);
      loadEntries();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timeEntriesApi.delete(id);
      message.success('Entry deleted');
      loadEntries();
    } catch {
      message.error('Failed to delete entry');
    }
  };

  const handleSubmitEntry = async (id: string) => {
    try {
      await timeEntriesApi.submit(id);
      message.success('Entry submitted for approval');
      loadEntries();
    } catch {
      message.error('Failed to submit entry');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await timeEntriesApi.approve(id);
      message.success('Entry approved');
      loadEntries();
    } catch {
      message.error('Failed to approve entry');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await timeEntriesApi.reject(id);
      message.success('Entry rejected');
      loadEntries();
    } catch {
      message.error('Failed to reject entry');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await timeEntriesApi.copy(id);
      message.success('Entry copied to today');
      loadEntries();
    } catch {
      message.error('Failed to copy entry');
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      width: 110,
    },
    ...(isManagerOrAdmin
      ? [{ title: 'Employee', dataIndex: ['user', 'fullName'], width: 140 }]
      : []),
    { title: 'Project', dataIndex: ['project', 'projectName'], width: 140 },
    { title: 'Task', dataIndex: ['task', 'taskName'], width: 140 },
    {
      title: 'Time',
      render: (_: unknown, r: TimeEntry) =>
        `${dayjs(r.startTime).format('HH:mm')} – ${dayjs(r.endTime).format('HH:mm')}`,
      width: 120,
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      render: (v: number) => formatMinutes(v),
      width: 90,
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
      width: 100,
    },
    {
      title: 'Actions',
      render: (_: unknown, record: TimeEntry) => (
        <Space size="small">
          {record.status === 'DRAFT' && (
            <>
              <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
              <Popconfirm title="Submit for approval?" onConfirm={() => handleSubmitEntry(record.id)}>
                <Button size="small" type="primary">Submit</Button>
              </Popconfirm>
              <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {record.status === 'SUBMITTED' && isManagerOrAdmin && (
            <>
              <Popconfirm title="Approve?" onConfirm={() => handleApprove(record.id)}>
                <Button size="small" type="primary" icon={<CheckOutlined />}>Approve</Button>
              </Popconfirm>
              <Popconfirm title="Reject?" onConfirm={() => handleReject(record.id)}>
                <Button size="small" danger icon={<CloseOutlined />}>Reject</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'REJECTED' && (
            <>
              <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
              <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.id)}>
            Copy
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Time Entries</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Entry
        </Button>
      </div>

      {/* Filters */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="All projects"
            style={{ width: '100%' }}
            allowClear
            value={filterProject}
            onChange={(v) => { setFilterProject(v); setPage(1); }}
            options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="All statuses"
            style={{ width: '100%' }}
            allowClear
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            options={['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => ({ value: s, label: s }))}
          />
        </Col>
        <Col xs={24} sm={8} md={10}>
          <RangePicker
            style={{ width: '100%' }}
            value={filterRange}
            onChange={(v) => { setFilterRange(v as [Dayjs, Dayjs] | null); setPage(1); }}
          />
        </Col>
      </Row>

      <Table
        dataSource={entries}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: setPage,
          showTotal: (t) => `${t} entries`,
        }}
      />

      {/* Create / Edit modal */}
      <Modal
        title={editEntry ? 'Edit Time Entry' : 'New Time Entry'}
        open={modalOpen}
        onOk={handleSubmitModal}
        onCancel={() => setModalOpen(false)}
        okText={editEntry ? 'Save' : 'Create'}
        width={540}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
                <Select
                  placeholder="Select project"
                  options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
                  onChange={(v) => {
                    form.setFieldValue('taskId', undefined);
                    loadTasksForProject(v);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskId" label="Task" rules={[{ required: true }]}>
                <Select
                  placeholder="Select task"
                  options={tasks.map((t) => ({ value: t.id, label: t.taskName }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label="Start" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label="End" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="workType" label="Work Type">
            <Select
              options={workTypes.map((w) => ({ value: w, label: w }))}
              placeholder="Select type"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What did you work on?" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="relatedCommitHash" label="Related Commit Hash">
                <Input placeholder="e.g. abc123f" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="relatedClickUpTaskId" label="ClickUp Task ID">
                <Input placeholder="e.g. #abc123" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
