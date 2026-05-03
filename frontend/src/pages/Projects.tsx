import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Tag, Typography, App,
} from 'antd';
import { PlusOutlined, EditOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { projectsApi, type CreateProjectDto } from '../api/projects.api';
import { usersApi } from '../api/users.api';
import { useAuthStore } from '../store/auth.store';
import type { Project, User } from '../types';

const { Title } = Typography;

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  ARCHIVED: 'warning',
};

export default function Projects() {
  const { message } = App.useApp();
  const currentUser = useAuthStore((s) => s.user);
  const isReadOnly = currentUser?.role === 'EMPLOYEE';
  const isAdmin = currentUser?.role === 'ADMIN';
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.findAll({ page, limit: 10 });
      setProjects(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await usersApi.findAll({ limit: 100 });
      setUsers(res.data.data);
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); if (isAdmin) loadUsers(); }, [page]);

  const openCreate = () => {
    setEditProject(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    form.setFieldsValue({
      projectName: p.projectName,
      description: p.description,
      status: p.status,
      managerId: p.managerId,
      gitRepositoryUrl: p.gitRepositoryUrl,
      externalClickUpListId: p.externalClickUpListId,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values: CreateProjectDto = await form.validateFields();
      if (editProject) {
        await projectsApi.update(editProject.id, values);
        message.success('Project updated');
      } else {
        await projectsApi.create(values);
        message.success('Project created');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) message.error(msg);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await projectsApi.archive(id);
      message.success('Project archived');
      load();
    } catch {
      message.error('Failed to archive project');
    }
  };

  const columns = [
    { title: 'Project Name', dataIndex: 'projectName', width: 180 },
    { title: 'Description', dataIndex: 'description', render: (v: string | null) => v ?? '—' },
    {
      title: 'Manager',
      dataIndex: ['manager', 'fullName'],
      width: 140,
      render: (v: string | undefined) => v ?? '—',
    },
    {
      title: 'Git Repository',
      dataIndex: 'gitRepositoryUrl',
      width: 200,
      render: (v: string | null) =>
        v ? <a href={v} target="_blank" rel="noreferrer">{v}</a> : '—',
    },
    {
      title: 'ClickUp List ID',
      dataIndex: 'externalClickUpListId',
      width: 140,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Tag color={statusColor[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    ...(!isReadOnly ? [{
      title: 'Actions',
      width: 130,
      render: (_: unknown, record: Project) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          {record.status !== 'ARCHIVED' && (
            <Popconfirm title="Archive this project?" onConfirm={() => handleArchive(record.id)}>
              <Button size="small" icon={<InboxOutlined />} title="Archive" />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Projects</Title>
        {!isReadOnly && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Project</Button>}
      </div>

      <Table
        dataSource={projects}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ current: page, total, pageSize: 10, onChange: setPage }}
      />

      {!isReadOnly && <Modal
        title={editProject ? 'Edit Project' : 'New Project'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editProject ? 'Save' : 'Create'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="projectName" label="Project Name" rules={[{ required: true }]}>
            <Input placeholder="Enter project name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select
              options={['ACTIVE', 'INACTIVE', 'ARCHIVED'].map((s) => ({ value: s, label: s }))}
            />
          </Form.Item>
          {isAdmin && (
            <Form.Item name="managerId" label="Project Manager">
              <Select
                placeholder="Assign a manager"
                allowClear
                showSearch
                optionFilterProp="label"
                options={users
                  .filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN')
                  .map((u) => ({ value: u.id, label: u.fullName }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="gitRepositoryUrl"
            label="Git Repository URL"
            rules={[{ type: 'url', message: 'Please enter a valid URL' }]}
          >
            <Input placeholder="https://github.com/org/repo" />
          </Form.Item>
          <Form.Item name="externalClickUpListId" label="ClickUp List ID">
            <Input placeholder="e.g. abc123xyz" />
          </Form.Item>
        </Form>
      </Modal>}
    </div>
  );
}
