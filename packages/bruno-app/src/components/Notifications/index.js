import { IconBell } from '@tabler/icons';
import { useTranslation } from 'react-i18next';
import ToolHint from 'components/ToolHint';
import StyledWrapper from './StyledWrapper';
import NotificationsModal from './NotificationsModal';
import useNotifications from './hooks/useNotifications';

const Notifications = () => {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const { isOpen, unreadCount, open, close } = notifications;

  return (
    <>
      <StyledWrapper onClick={open} aria-label={t('NOTIFICATIONS.CHECK_ALL')}>
        <ToolHint text={t('NOTIFICATIONS.TITLE')} toolhintId="Notifications" offset={8}>
          <IconBell size={16} aria-hidden strokeWidth={1.5} />
          {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
        </ToolHint>
      </StyledWrapper>

      {isOpen && <NotificationsModal notifications={notifications} onClose={close} />}
    </>
  );
};

export default Notifications;
