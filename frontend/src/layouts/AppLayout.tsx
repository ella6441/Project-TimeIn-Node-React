import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Typography,
  Dropdown,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  ApiOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import type { Role } from '../types';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  roles: Role[];
}

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { key: '/time-entries', icon: <ClockCircleOutlined />, label: 'Time Entries', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { key: '/projects', icon: <ProjectOutlined />, label: 'Projects', roles: ['MANAGER', 'ADMIN'] },
  { key: '/tasks', icon: <CheckSquareOutlined />, label: 'Tasks', roles: ['MANAGER', 'ADMIN'] },
  { key: '/users', icon: <TeamOutlined />, label: 'Users', roles: ['ADMIN'] },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Reports', roles: ['MANAGER', 'ADMIN'] },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings', roles: ['ADMIN'] },
  { key: '/integrations', icon: <ApiOutlined />, label: 'Integrations', roles: ['ADMIN'] },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { token } = theme.useToken();

  const visibleItems = menuItems
    .filter((item) => user && item.roles.includes(user.role))
    .map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    }));

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: '#001529' }}
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <ClockCircleOutlined style={{ color: token.colorPrimary, fontSize: 22 }} />
          {!collapsed && (
            <Text
              strong
              style={{ color: '#fff', marginLeft: 10, fontSize: 18, letterSpacing: 1 }}
            >
              TimeIn
            </Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <Avatar icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
              <div style={{ lineHeight: 1.3 }}>
                <Text strong style={{ display: 'block', fontSize: 13 }}>
                  {user?.fullName}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {user?.role}
                </Text>
              </div>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
