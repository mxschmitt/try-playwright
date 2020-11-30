import React from 'react';
import { Nav, Icon, Navbar } from 'rsuite'
import { FeedbackFish } from '@feedback-fish/react'

import styles from './Header.module.css'

const Header: React.FunctionComponent = () => {
  return (
    <Navbar appearance="inverse">
      <Navbar.Header>
        <Nav>
          <Nav.Item href="https://playwright.tech">
            <strong className={styles.hideSmallScreens}>Try</strong>{' '}
            <strong>Playwright</strong>{' '}
            <span role="img" aria-label="Playwright">🎭</span>
          </Nav.Item>
        </Nav>
      </Navbar.Header>
      <Navbar.Body>
        <Nav pullRight>
          <Nav.Item href="https://playwright.dev" target="_blank" rel="noopener noreferrer" icon={<Icon icon="info-circle" />}>
            <span className={styles.hideSmallScreens}>
              Documentation
            </span>
            <span className={styles.hideBigScreens}>
              Docs
            </span>
          </Nav.Item>
          <FeedbackFish projectId="bcb98dfe103a3f">
            <Nav.Item icon={<Icon icon="lightbulb-o" />} className={styles.hideSmallScreens}>
              Send Feedback
            </Nav.Item>
          </FeedbackFish>
          <Nav.Item href="https://github.com/mxschmitt/try-playwright" icon={<Icon icon="github" />}>
            <span className={styles.hideSmallScreens}>
              View
            </span>
            {' '}
            Source
          </Nav.Item>
        </Nav>
      </Navbar.Body>
    </Navbar>
  )
}

export default Header;
