import React, { useContext } from 'react';
import { Nav, Icon, Navbar } from 'rsuite'
import { CodeLanguage } from '../constants';
import { CodeContext } from './CodeContext';

import styles from './Header.module.css'

const Header: React.FunctionComponent = () => {
  const { codeLanguage } = useContext(CodeContext)
  const documentationLink = determineDocumentationLink(codeLanguage)
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
          <Nav.Item href={documentationLink} target="_blank" rel="noopener noreferrer" icon={<Icon icon="info-circle" />}>
            <span className={styles.hideSmallScreens}>
              Documentation
            </span>
            <span className={styles.hideBigScreens}>
              Docs
            </span>
          </Nav.Item>
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


function determineDocumentationLink(codeLanguage: CodeLanguage):string {
  switch (codeLanguage) {
    case CodeLanguage.JAVA:
      return "https://playwright.dev/java/docs/intro/"
    case CodeLanguage.PYTHON:
      return "https://playwright.dev/python/docs/intro/"
    case CodeLanguage.DOTNET:
        return "https://playwright.dev/dotnet/docs/intro/"
    default:
      return "https://playwright.dev/docs/intro/"
  }
}
