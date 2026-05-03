import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Typography,
  Dropdown,
  theme,
  Badge,
  Popover,
  List,
  Tag,
  Empty,
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
  BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { notificationsApi } from '../api/notifications.api';
import type { Role, Notification } from '../types';

dayjs.extend(relativeTime);

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
  { key: '/projects', icon: <ProjectOutlined />, label: 'Projects', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { key: '/tasks', icon: <CheckSquareOutlined />, label: 'Tasks', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { key: '/users', icon: <TeamOutlined />, label: 'Users', roles: ['ADMIN', 'MANAGER'] },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Reports', roles: ['MANAGER', 'ADMIN'] },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings', roles: ['ADMIN'] },
  { key: '/integrations', icon: <ApiOutlined />, label: 'Integrations', roles: ['ADMIN'] },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { token } = theme.useToken();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationsApi.countUnread();
      setUnreadCount(res.data.count);
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.findMine({ limit: 20 });
      setNotifications(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchUnread]);

  const handleOpenNotif = async (open: boolean) => {
    setNotifOpen(open);
    if (open) {
      await fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (n: Notification) => {
    if (n.isRead) return;
    await notificationsApi.markRead(n.id);
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Popover
              open={notifOpen}
              onOpenChange={handleOpenNotif}
              trigger="click"
              placement="bottomRight"
              arrow={false}
              content={
                <div style={{ width: 340 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0, fontSize: 12 }}>
                        Mark all as read
                      </Button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <Empty description="No notifications" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '16px 0' }} />
                  ) : (
                    <List
                      dataSource={notifications}
                      style={{ maxHeight: 380, overflowY: 'auto' }}
                      renderItem={(n) => (
                        <List.Item
                          key={n.id}
                          onClick={() => handleMarkRead(n)}
                          style={{
                            padding: '10px 12px',
                            background: n.isRead ? 'transparent' : token.colorPrimaryBg,
                            borderRadius: 6,
                            cursor: n.isRead ? 'default' : 'pointer',
                            marginBottom: 4,
                            borderBottom: 'none',
                          }}
                        >
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 13 }}>{n.title}</span>
                              {!n.isRead && <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>New</Tag>}
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{n.body}</div>
                            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{dayjs(n.createdAt).fromNow()}</div>
                          </div>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              }
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18 }} />}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}
                />
              </Badge>
            </Popover>

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
          </div>
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
