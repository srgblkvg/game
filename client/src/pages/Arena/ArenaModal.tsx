import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

interface ArenaModalProps {
    message: string;
    onClose: () => void;
}

export default function ArenaModal({ message, onClose }: ArenaModalProps) {
    return (
        <Modal open={!!message} onClose={onClose}>
            <p className="whitespace-pre-wrap mb-4">{message}</p>
            <Button variant="danger" size="sm" fullWidth onClick={onClose}>OK</Button>
        </Modal>
    );
}
