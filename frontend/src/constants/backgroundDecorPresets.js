/**
 * Sdílené parametry pro useRandomDecorations)
 */
export const backgroundDecorPresets = {
  /** TeacherMainPage, StudentMainPage (ClassListPageLayout) */
  mainList: {
    seed: 99,
    starsMin: 50,
    starsRange: 1,
    flightsMin: 10,
    flightsRange: 1,
  },

  /** AuthLoginPage, AuthRegisterPage */
  auth: {
    seed: 77,
    starsMin: 50,
    starsRange: 1,
    flightsMin: 5,
    flightsRange: 1,
  },

  /** RoleSelect */
  roleSelect: {
    seed: 42,
    starsMin: 30,
    starsRange: 1,
    flightsMin: 10,
    flightsRange: 1,
  },

  /**
   * TeacherClassDetail, StudentClassDetail, TeacherTopicDetail
   * (defaultní počty hvězd/letadel z useRandomDecorations)
   */
  classTopicDetail: {
    seed: 123,
    starsMin: 50,
    starsRange: 1,
    flightsMin: 10,
    flightsRange: 1,
  },
};
